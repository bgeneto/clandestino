import type { PlacementFormat } from '@clandestino/shared-contracts';
import {
  buildBracketFourState,
  computeNextBracketMatches,
  generateBracketSemifinals,
  generateGroupMatches,
  orderPlayerPair,
  type BracketMatchInput,
} from '@clandestino/tournament-engine';
import { and, eq, inArray } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { schema } from '../db/index.js';
import { PLACEMENT_PHASE } from './draw.js';

type Transaction = Parameters<Parameters<FastifyInstance['db']['transaction']>[0]>[0];
type GroupRow = InferSelectModel<typeof schema.groups>;
type MatchRow = InferSelectModel<typeof schema.matches>;
type ParticipantRow = InferSelectModel<typeof schema.matchParticipants>;

export function getPlacementGroupRange(group: GroupRow): { from: number; to: number } | null {
  if (group.positionFrom !== null && group.positionTo !== null) {
    return { from: group.positionFrom, to: group.positionTo };
  }

  const match = /^Colocação (\d+)º-(\d+)º$/.exec(group.name);
  if (!match) {
    return null;
  }

  return { from: Number(match[1]), to: Number(match[2]) };
}

export async function isPlacementBandStarted(tx: Transaction, groupId: string): Promise<boolean> {
  const [confirmed] = await tx
    .select({ id: schema.matches.id })
    .from(schema.matches)
    .where(
      and(
        eq(schema.matches.groupId, groupId),
        eq(schema.matches.phase, PLACEMENT_PHASE),
        inArray(schema.matches.status, ['CONFIRMADA', 'CORRIGIDA']),
      ),
    )
    .limit(1);

  return Boolean(confirmed);
}

export function buildPlacementMatchSpecs(
  format: PlacementFormat,
  playerIds: string[],
  bracketSeed?: string,
): Array<{
  playerOneId: string;
  playerTwoId: string;
  bracketRound?: 'SEMIFINAL' | 'FINAL' | 'THIRD_PLACE';
}> {
  if (format === 'knockout') {
    const [playerA, playerB] = playerIds;
    if (!playerA || !playerB) {
      return [];
    }
    return [orderPlayerPair(playerA, playerB)];
  }

  if (format === 'bracket-4') {
    if (!bracketSeed) {
      throw new Error('bracketSeed is required for bracket-4 placement matches');
    }
    return generateBracketSemifinals(playerIds, bracketSeed).map((pairing) => ({
      ...orderPlayerPair(pairing.playerA, pairing.playerB),
      bracketRound: pairing.bracketRound,
    }));
  }

  return generateGroupMatches({ playerIds }).map((match) => ({
    ...orderPlayerPair(match.playerA, match.playerB),
  }));
}

async function loadBracketMatchInputs(
  tx: Transaction,
  groupId: string,
): Promise<BracketMatchInput[]> {
  const matches = await tx
    .select()
    .from(schema.matches)
    .where(and(eq(schema.matches.groupId, groupId), eq(schema.matches.phase, PLACEMENT_PHASE)));

  const matchIds = matches.map((match) => match.id);
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

  return matches
    .filter((match): match is MatchRow & { bracketRound: NonNullable<MatchRow['bracketRound']> } =>
      Boolean(match.bracketRound),
    )
    .map((match) => {
      const rows = participantsByMatchId.get(match.id) ?? [];
      const playerOne = rows.find((row) => row.playerId === match.playerOneId);
      const playerTwo = rows.find((row) => row.playerId === match.playerTwoId);
      const winnerId =
        playerOne && playerTwo
          ? playerOne.setsWon > playerTwo.setsWon
            ? match.playerOneId
            : playerTwo.setsWon > playerOne.setsWon
              ? match.playerTwoId
              : undefined
          : undefined;

      return {
        bracketRound: match.bracketRound,
        playerOneId: match.playerOneId,
        playerTwoId: match.playerTwoId,
        winnerId,
        walkoverAbsentPlayerId: match.walkoverAbsentPlayerId ?? undefined,
        confirmed: match.status === 'CONFIRMADA' || match.status === 'CORRIGIDA',
      };
    });
}

export async function advanceBracketFourForGroup(
  tx: Transaction,
  editionId: string,
  groupId: string,
  withdrawnPlayerIds: ReadonlySet<string>,
  createdBy: string,
): Promise<number> {
  const bracketMatches = await loadBracketMatchInputs(tx, groupId);
  if (bracketMatches.length < 2) {
    return 0;
  }

  const state = buildBracketFourState(bracketMatches);
  const nextMatches = computeNextBracketMatches(state, withdrawnPlayerIds);
  if (nextMatches.length === 0) {
    return 0;
  }

  const inserted = await tx
    .insert(schema.matches)
    .values(
      nextMatches.map((match) => ({
        editionId,
        groupId,
        phase: PLACEMENT_PHASE,
        playerOneId: match.playerOneId,
        playerTwoId: match.playerTwoId,
        bracketRound: match.bracketRound,
        status: 'AGENDADA' as const,
      })),
    )
    .returning({
      id: schema.matches.id,
      playerOneId: schema.matches.playerOneId,
      playerTwoId: schema.matches.playerTwoId,
      bracketRound: schema.matches.bracketRound,
    });

  await tx.insert(schema.matchParticipants).values(
    inserted.flatMap((match) => [
      { matchId: match.id, playerId: match.playerOneId, setsWon: 0 },
      { matchId: match.id, playerId: match.playerTwoId, setsWon: 0 },
    ]),
  );

  await tx.insert(schema.auditEvents).values({
    editionId,
    eventType: 'BRACKET_ADVANCED',
    payload: {
      groupId,
      matches: inserted.map((match) => ({
        matchId: match.id,
        bracketRound: match.bracketRound,
        playerOneId: match.playerOneId,
        playerTwoId: match.playerTwoId,
      })),
    },
    createdBy,
  });

  return inserted.length;
}
