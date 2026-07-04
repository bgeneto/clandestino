import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  ErrorResponseSchema,
  WithdrawPlayerBodySchema,
  WithdrawPlayerResponseSchema,
} from '@clandestino/shared-contracts';
import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';
import { withdrawPlayerFromEdition } from '../lib/withdrawals.js';
import { emitPlayerWithdrawn } from '../lib/sse-events.js';

const editionIdParams = Type.Object({ id: Type.String({ format: 'uuid' }) });

export async function registerEditionWithdrawalRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  typed.post(
    '/editions/:id/withdrawals',
    {
      preHandler: app.requireOrganizer,
      schema: {
        params: editionIdParams,
        body: WithdrawPlayerBodySchema,
        response: {
          200: WithdrawPlayerResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const organizer = request.organizerEmail ?? 'organizer';
      const result = await withdrawPlayerFromEdition(
        app.db,
        request.params.id,
        request.body.playerId,
        organizer,
      );

      await emitPlayerWithdrawn(app, request.params.id, { playerId: result.playerId });

      return {
        playerId: result.playerId,
        withdrawnAt: result.withdrawnAt.toISOString(),
        withdrawnDuringPhase: result.withdrawnDuringPhase,
      };
    },
  );
}
