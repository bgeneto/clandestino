import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  ErrorResponseSchema,
  OrganizerActiveEditionsResponseSchema,
} from '@clandestino/shared-contracts';
import type { FastifyInstance } from 'fastify';
import { loadOrganizerActiveEditions } from '../lib/organizer-dashboard.js';

export async function registerOrganizerDashboardRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<TypeBoxTypeProvider>();

  typed.get(
    '/organizer/active-editions',
    {
      preHandler: app.requireOrganizer,
      schema: {
        response: {
          200: OrganizerActiveEditionsResponseSchema,
          401: ErrorResponseSchema,
        },
      },
    },
    async () => {
      const editions = await loadOrganizerActiveEditions(app.db);
      return { editions };
    },
  );
}
