import type { PlacementFormat } from '@clandestino/shared-contracts';
import {
  adaptPlacementBand,
  applyWithdrawalToGroupStanding,
  calculateGroupStanding,
  resolveMinigroupThreeAfterWithdrawal,
  type StandingMatch,
} from '@clandestino/tournament-engine';
import { and, eq, inArray, ne, or } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { schema } from '../db/index.js';
import {
  advanceBracketFourForGroup,
  getPlacementGroupRange,
  isPlacementBandStarted,
} from './bracket-placement.js';
import { generateSecureToken } from './crypto.js';
import { GROUP_PHASE, PLACEMENT_PHASE } from './draw.js';
import { loadWithdrawnPlayerIds } from './edition-registrations.js';
import { conflict, notFound } from './errors.js';
import { WALKOVER_LOSER_SETS, WALKOVER_WINNER_SETS } from './match-result.js';
import {
  maybeGeneratePlacementStage,
  recalculateGroupStanding,
  toStandingMatch,
} from './matches.js';

type DbExecutor = Pick<
  FastifyInstance['db'],
  'select' | 'insert' | 'update' | 'delete' | 'transaction'
>;
type Transaction = Parameters<Parameters<FastifyInstance['db']['transaction']>[0]>[0];
type RegistrationRow = InferSelectModel<typeof schema.editionRegistrations>;

export interface WithdrawnRegistration {
  playerId: string;
  withdrawnAt: Date;
  withdrawnDuringPhase: 'GROUP_STAGE' | 'PLACEMENT_STAGE';
}

export async function loadWithdrawnRegistrations(
  db: DbExecutor,
  editionId: string,
): Promise<WithdrawnRegistration[]> {
  const rows = await db
    .select()
    .from(schema.editionRegistrations)
    .where(eq(schema.editionRegistrations.editionId, editionId));

  return rows
    .filter(
      (
        row,
      ): row is RegistrationRow & {
        withdrawnAt: Date;
        withdrawnDuringPhase: 'GROUP_STAGE' | 'PLACEMENT_STAGE';
      } => row.withdrawnAt !== null && row.withdrawnDuringPhase !== null,
    )
    .map((row) => ({
      playerId: row.playerId,
      withdrawnAt: row.withdrawnAt,
      withdrawnDuringPhase: row.withdrawnDuringPhase,
    }));
}

async function loadPlayerPlacementGroup(
  tx: Transaction,
  editionId: string,
  playerId: string,
): Promise<InferSelectModel<typeof schema.groups> | null> {
  const [groupPlayer] = await tx
    .select({ groupId: schema.groupPlayers.groupId })
    .from(schema.groupPlayers)
    .innerJoin(schema.groups, eq(schema.groupPlayers.groupId, schema.groups.id))
    .where(
      and(
        eq(schema.groupPlayers.editionId, editionId),
        eq(schema.groupPlayers.playerId, playerId),
        eq(schema.groups.phase, PLACEMENT_PHASE),
      ),
    )
    .limit(1);

  if (!groupPlayer) {
    return null;
  }

  const [group] = await tx
    .select()
    .from(schema.groups)
    .where(eq(schema.groups.id, groupPlayer.groupId))
    .limit(1);

  return group ?? null;
}

async function autoWalkoverMatch(
  tx: Transaction,
  matchId: string,
  absentPlayerId: string,
  createdBy: string,
): Promise<void> {
  const [match] = await tx
    .select()
    .from(schema.matches)
    .where(eq(schema.matches.id, matchId))
    .limit(1);

  if (!match) {
    return;
  }

  if (
    match.status === 'CONFIRMADA' ||
    match.status === 'CORRIGIDA' ||
    match.status === 'CANCELADA'
  ) {
    return;
  }

  const winnerId = absentPlayerId === match.playerOneId ? match.playerTwoId : match.playerOneId;
  const now = new Date();

  await tx
    .update(schema.matchParticipants)
    .set({
      setsWon: winnerId === match.playerOneId ? WALKOVER_WINNER_SETS : WALKOVER_LOSER_SETS,
    })
    .where(
      and(
        eq(schema.matchParticipants.matchId, match.id),
        eq(schema.matchParticipants.playerId, match.playerOneId),
      ),
    );

  await tx
    .update(schema.matchParticipants)
    .set({
      setsWon: winnerId === match.playerTwoId ? WALKOVER_WINNER_SETS : WALKOVER_LOSER_SETS,
    })
    .where(
      and(
        eq(schema.matchParticipants.matchId, match.id),
        eq(schema.matchParticipants.playerId, match.playerTwoId),
      ),
    );

  await tx
    .update(schema.matches)
    .set({
      status: 'CONFIRMADA',
      outcome: 'WALKOVER',
      walkoverAbsentPlayerId: absentPlayerId,
      updatedAt: now,
    })
    .where(eq(schema.matches.id, match.id));

  const [edition] = await tx
    .select()
    .from(schema.editions)
    .where(eq(schema.editions.id, match.editionId))
    .limit(1);

  if (!edition) {
    return;
  }

  await recalculateGroupStanding(tx, match.groupId, edition.rules);

  if (match.phase === GROUP_PHASE) {
    await maybeGeneratePlacementStage(tx, match.editionId, edition.rules, createdBy);
  } else if (match.phase === PLACEMENT_PHASE) {
    const withdrawnIds = await loadWithdrawnPlayerIds(tx, match.editionId);
    await advanceBracketFourForGroup(tx, match.editionId, match.groupId, withdrawnIds, createdBy);
  }

  await tx.insert(schema.auditEvents).values({
    editionId: match.editionId,
    matchId: match.id,
    eventType: 'MATCH_WALKOVER',
    payload: {
      absentPlayerId,
      winnerId,
      automatic: true,
    },
    createdBy,
  });
}

async function cancelScheduledPlacementMatches(tx: Transaction, groupId: string): Promise<void> {
  const scheduled = await tx
    .select({ id: schema.matches.id })
    .from(schema.matches)
    .where(
      and(
        eq(schema.matches.groupId, groupId),
        eq(schema.matches.phase, PLACEMENT_PHASE),
        eq(schema.matches.status, 'AGENDADA'),
      ),
    );

  if (scheduled.length === 0) {
    return;
  }

  const now = new Date();
  for (const match of scheduled) {
    await tx
      .update(schema.matches)
      .set({ status: 'CANCELADA', updatedAt: now })
      .where(eq(schema.matches.id, match.id));
  }
}

async function voidWithdrawnPlacementMatches(
  tx: Transaction,
  groupId: string,
  withdrawnPlayerId: string,
): Promise<void> {
  const matches = await tx
    .select()
    .from(schema.matches)
    .where(
      and(
        eq(schema.matches.groupId, groupId),
        eq(schema.matches.phase, PLACEMENT_PHASE),
        or(
          eq(schema.matches.playerOneId, withdrawnPlayerId),
          eq(schema.matches.playerTwoId, withdrawnPlayerId),
        ),
        ne(schema.matches.status, 'CANCELADA'),
      ),
    );

  const now = new Date();
  for (const match of matches) {
    await tx
      .update(schema.matches)
      .set({ status: 'CANCELADA', updatedAt: now })
      .where(eq(schema.matches.id, match.id));
  }
}

async function reshapePlacementBand(
  tx: Transaction,
  editionId: string,
  groupId: string,
  withdrawnPlayerId: string,
  createdBy: string,
): Promise<void> {
  const [group] = await tx
    .select()
    .from(schema.groups)
    .where(eq(schema.groups.id, groupId))
    .limit(1);

  if (!group) {
    return;
  }

  const players = await tx
    .select({ playerId: schema.groupPlayers.playerId })
    .from(schema.groupPlayers)
    .where(eq(schema.groupPlayers.groupId, groupId));

  const allPlayerIds = players.map((row) => row.playerId);
  const adapted = adaptPlacementBand(allPlayerIds, [withdrawnPlayerId]);

  await tx
    .delete(schema.groupPlayers)
    .where(
      and(
        eq(schema.groupPlayers.groupId, groupId),
        eq(schema.groupPlayers.playerId, withdrawnPlayerId),
      ),
    );

  await cancelScheduledPlacementMatches(tx, groupId);

  const bracketSeed =
    adapted.format === 'bracket-4' ? (group.bracketSeed ?? generateSecureToken(16)) : null;

  await tx
    .update(schema.groups)
    .set({
      placementFormat: adapted.format,
      bracketSeed,
    })
    .where(eq(schema.groups.id, groupId));

  await tx.insert(schema.auditEvents).values({
    editionId,
    eventType: 'PLACEMENT_BAND_RESHAPED',
    payload: {
      groupId,
      withdrawnPlayerId,
      format: adapted.format,
      activePlayerIds: adapted.activePlayerIds,
    },
    createdBy,
  });
}

async function applyGroupStageWithdrawal(
  tx: Transaction,
  editionId: string,
  playerId: string,
  rules: InferSelectModel<typeof schema.editions>['rules'],
  createdBy: string,
): Promise<void> {
  const pendingMatches = await tx
    .select({ id: schema.matches.id })
    .from(schema.matches)
    .where(
      and(
        eq(schema.matches.editionId, editionId),
        eq(schema.matches.phase, GROUP_PHASE),
        or(eq(schema.matches.playerOneId, playerId), eq(schema.matches.playerTwoId, playerId)),
        inArray(schema.matches.status, ['AGENDADA', 'AGUARDANDO_CONFIRMACAO']),
      ),
    );

  for (const match of pendingMatches) {
    await autoWalkoverMatch(tx, match.id, playerId, createdBy);
  }

  const groupPlayers = await tx
    .select({ groupId: schema.groupPlayers.groupId })
    .from(schema.groupPlayers)
    .innerJoin(schema.groups, eq(schema.groupPlayers.groupId, schema.groups.id))
    .where(
      and(
        eq(schema.groupPlayers.editionId, editionId),
        eq(schema.groupPlayers.playerId, playerId),
        eq(schema.groups.phase, GROUP_PHASE),
      ),
    );

  const withdrawnAt = new Date();
  for (const entry of groupPlayers) {
    const groupMatches = await tx
      .select()
      .from(schema.matches)
      .where(eq(schema.matches.groupId, entry.groupId));

    const matchIds = groupMatches.map((match) => match.id);
    const participants =
      matchIds.length === 0
        ? []
        : await tx
            .select()
            .from(schema.matchParticipants)
            .where(inArray(schema.matchParticipants.matchId, matchIds));

    const participantsByMatchId = new Map<string, typeof participants>();
    for (const participant of participants) {
      const current = participantsByMatchId.get(participant.matchId) ?? [];
      current.push(participant);
      participantsByMatchId.set(participant.matchId, current);
    }

    const standingMatches = groupMatches
      .map((match) => toStandingMatch(match, participantsByMatchId.get(match.id) ?? []))
      .filter((match): match is StandingMatch => match !== null);

    const entries = applyWithdrawalToGroupStanding(calculateGroupStanding(standingMatches, rules), [
      { playerId, withdrawnAt },
    ]);

    await tx.delete(schema.standings).where(eq(schema.standings.groupId, entry.groupId));
    if (entries.length > 0) {
      await tx.insert(schema.standings).values(
        entries.map((standing) => ({
          groupId: entry.groupId,
          playerId: standing.playerId,
          setsWon: standing.setsWon,
          setDiff: standing.setDiff,
          matchesWon: standing.matchesWon,
          rankInGroup: standing.rankInGroup,
        })),
      );
    }
  }

  await maybeGeneratePlacementStage(tx, editionId, rules, createdBy);
}

async function midBandPlacementWithdrawal(
  tx: Transaction,
  editionId: string,
  group: InferSelectModel<typeof schema.groups>,
  playerId: string,
  createdBy: string,
): Promise<void> {
  const format = group.placementFormat ?? 'round-robin';

  const pendingMatches = await tx
    .select({ id: schema.matches.id })
    .from(schema.matches)
    .where(
      and(
        eq(schema.matches.groupId, group.id),
        eq(schema.matches.phase, PLACEMENT_PHASE),
        or(eq(schema.matches.playerOneId, playerId), eq(schema.matches.playerTwoId, playerId)),
        inArray(schema.matches.status, ['AGENDADA', 'AGUARDANDO_CONFIRMACAO']),
      ),
    );

  for (const match of pendingMatches) {
    await autoWalkoverMatch(tx, match.id, playerId, createdBy);
  }

  if (format === 'round-robin') {
    const players = await tx
      .select({ playerId: schema.groupPlayers.playerId })
      .from(schema.groupPlayers)
      .where(eq(schema.groupPlayers.groupId, group.id));

    if (players.length === 3) {
      await voidWithdrawnPlacementMatches(tx, group.id, playerId);
      await recalculateGroupStanding(
        tx,
        group.id,
        (
          await tx.select().from(schema.editions).where(eq(schema.editions.id, editionId)).limit(1)
        )[0]!.rules,
      );

      const range = getPlacementGroupRange(group);
      if (!range) {
        return;
      }

      const groupMatches = await tx
        .select()
        .from(schema.matches)
        .where(
          and(eq(schema.matches.groupId, group.id), eq(schema.matches.phase, PLACEMENT_PHASE)),
        );

      const matchIds = groupMatches.map((match) => match.id);
      const participants =
        matchIds.length === 0
          ? []
          : await tx
              .select()
              .from(schema.matchParticipants)
              .where(inArray(schema.matchParticipants.matchId, matchIds));

      const participantsByMatchId = new Map<string, typeof participants>();
      for (const participant of participants) {
        const current = participantsByMatchId.get(participant.matchId) ?? [];
        current.push(participant);
        participantsByMatchId.set(participant.matchId, current);
      }

      const standingMatches = groupMatches
        .map((match) => toStandingMatch(match, participantsByMatchId.get(match.id) ?? []))
        .filter((match): match is StandingMatch => match !== null);

      const resolution = resolveMinigroupThreeAfterWithdrawal({
        playerIds: players.map((row) => row.playerId),
        withdrawnPlayerId: playerId,
        matches: standingMatches,
        positionRange: range,
      });

      if (resolution.decisiveMatch) {
        const { playerOneId, playerTwoId } = orderPair(
          resolution.decisiveMatch.playerA,
          resolution.decisiveMatch.playerB,
        );
        const [inserted] = await tx
          .insert(schema.matches)
          .values({
            editionId,
            groupId: group.id,
            phase: PLACEMENT_PHASE,
            playerOneId,
            playerTwoId,
            status: 'AGENDADA',
          })
          .returning({ id: schema.matches.id });

        if (inserted) {
          await tx.insert(schema.matchParticipants).values([
            { matchId: inserted.id, playerId: playerOneId, setsWon: 0 },
            { matchId: inserted.id, playerId: playerTwoId, setsWon: 0 },
          ]);
        }
      }

      await tx.insert(schema.auditEvents).values({
        editionId,
        eventType: 'MATCHES_VOIDED_ON_WITHDRAWAL',
        payload: { groupId: group.id, withdrawnPlayerId: playerId },
        createdBy,
      });
    }
  }

  const withdrawnIds = await loadWithdrawnPlayerIds(tx, editionId);
  await advanceBracketFourForGroup(tx, editionId, group.id, withdrawnIds, createdBy);
}

function orderPair(
  playerA: string,
  playerB: string,
): {
  playerOneId: string;
  playerTwoId: string;
} {
  return playerA < playerB
    ? { playerOneId: playerA, playerTwoId: playerB }
    : { playerOneId: playerB, playerTwoId: playerA };
}

export async function withdrawPlayerFromEdition(
  db: DbExecutor,
  editionId: string,
  playerId: string,
  createdBy: string,
): Promise<WithdrawnRegistration> {
  const [edition] = await db
    .select()
    .from(schema.editions)
    .where(eq(schema.editions.id, editionId))
    .limit(1);

  if (!edition) {
    throw notFound('Edição não encontrada.');
  }

  if (edition.status === 'ENCERRADA' || edition.status === 'RASCUNHO') {
    throw conflict('Não é possível registrar abandono nesta fase da edição.');
  }

  const [registration] = await db
    .select()
    .from(schema.editionRegistrations)
    .where(
      and(
        eq(schema.editionRegistrations.editionId, editionId),
        eq(schema.editionRegistrations.playerId, playerId),
      ),
    )
    .limit(1);

  if (!registration) {
    throw notFound('Jogador não está inscrito nesta edição.');
  }

  if (registration.withdrawnAt) {
    throw conflict('Este jogador já foi marcado como retirado.');
  }

  const phase =
    edition.status === 'FASE_COLOCACAO' || edition.status === 'EM_ANDAMENTO'
      ? edition.status === 'FASE_COLOCACAO'
        ? 'PLACEMENT_STAGE'
        : await resolveActivePhase(db, editionId, playerId)
      : 'GROUP_STAGE';

  const withdrawnAt = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(schema.editionRegistrations)
      .set({
        withdrawnAt,
        withdrawnDuringPhase: phase,
      })
      .where(
        and(
          eq(schema.editionRegistrations.editionId, editionId),
          eq(schema.editionRegistrations.playerId, playerId),
        ),
      );

    if (phase === 'GROUP_STAGE') {
      await applyGroupStageWithdrawal(tx, editionId, playerId, edition.rules, createdBy);
    } else {
      const placementGroup = await loadPlayerPlacementGroup(tx, editionId, playerId);
      if (!placementGroup) {
        await applyGroupStageWithdrawal(tx, editionId, playerId, edition.rules, createdBy);
      } else {
        const bandStarted = await isPlacementBandStarted(tx, placementGroup.id);
        if (bandStarted) {
          await midBandPlacementWithdrawal(tx, editionId, placementGroup, playerId, createdBy);
        } else {
          await reshapePlacementBand(tx, editionId, placementGroup.id, playerId, createdBy);
        }
      }
    }

    await tx.insert(schema.auditEvents).values({
      editionId,
      eventType: 'PLAYER_WITHDRAWN',
      payload: {
        playerId,
        withdrawnDuringPhase: phase,
      },
      createdBy,
    });
  });

  return {
    playerId,
    withdrawnAt,
    withdrawnDuringPhase: phase,
  };
}

async function resolveActivePhase(
  db: DbExecutor,
  editionId: string,
  playerId: string,
): Promise<'GROUP_STAGE' | 'PLACEMENT_STAGE'> {
  const [placementPlayer] = await db
    .select({ groupId: schema.groupPlayers.groupId })
    .from(schema.groupPlayers)
    .innerJoin(schema.groups, eq(schema.groupPlayers.groupId, schema.groups.id))
    .where(
      and(
        eq(schema.groupPlayers.editionId, editionId),
        eq(schema.groupPlayers.playerId, playerId),
        eq(schema.groups.phase, PLACEMENT_PHASE),
      ),
    )
    .limit(1);

  if (placementPlayer) {
    const [placementMatch] = await db
      .select({ id: schema.matches.id })
      .from(schema.matches)
      .where(
        and(eq(schema.matches.editionId, editionId), eq(schema.matches.phase, PLACEMENT_PHASE)),
      )
      .limit(1);

    if (placementMatch) {
      return 'PLACEMENT_STAGE';
    }
  }

  return 'GROUP_STAGE';
}
