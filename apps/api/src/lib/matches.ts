import type {
  EditionRules,
  EditionStatus,
  MatchOutcome,
  MatchStatus,
} from '@clandestino/shared-contracts';
import { isMatchResolvedForEditionClose } from '@clandestino/shared-contracts';
import {
  COUNTED_MATCH_STATUSES,
  attachScoringPoints,
  buildBracketFourState,
  calculateFinalStanding,
  calculateGroupStanding,
  directPlacementsFromStandings,
  generateGroupMatches,
  generatePlacementStage,
  resolveBracketFourPositions,
  resolveMinigroupThreeAfterWithdrawal,
  assignMinigroupPositions,
  validateMatchResult,
  type BracketMatchInput,
  type GroupStandingInput,
  type PlacementGroupResult,
  type StandingMatch,
} from '@clandestino/tournament-engine';
import { and, asc, count, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { schema } from '../db/index.js';
import { GROUP_PHASE, PLACEMENT_PHASE } from './draw.js';
import { advanceBracketFourForGroup } from './bracket-placement.js';
import { getPlacementGroupRange } from './bracket-placement.js';
import { loadWithdrawnPlayerIds, loadWithdrawnPlayers } from './edition-registrations.js';
import { badRequest, conflict, notFound } from './errors.js';
import { mapMatch } from './mappers.js';

export { PLACEMENT_PHASE } from './draw.js';

type DbExecutor = Pick<
  FastifyInstance['db'],
  'select' | 'insert' | 'update' | 'delete' | 'transaction'
>;
type Transaction = Parameters<Parameters<FastifyInstance['db']['transaction']>[0]>[0];

type MatchRow = InferSelectModel<typeof schema.matches>;
type ParticipantRow = InferSelectModel<typeof schema.matchParticipants>;

export interface LoadedMatch {
  match: MatchRow;
  participants: ParticipantRow[];
}

export function mapSetsToParticipants(
  reporterId: string,
  playerOneId: string,
  playerTwoId: string,
  setsWonByReporter: number,
  setsWonByOpponent: number,
): { playerOneSets: number; playerTwoSets: number } {
  if (reporterId === playerOneId) {
    return {
      playerOneSets: setsWonByReporter,
      playerTwoSets: setsWonByOpponent,
    };
  }

  if (reporterId === playerTwoId) {
    return {
      playerOneSets: setsWonByOpponent,
      playerTwoSets: setsWonByReporter,
    };
  }

  throw conflict('O jogador não participa desta partida.');
}

export function toStandingMatch(
  match: MatchRow,
  participants: ParticipantRow[],
): StandingMatch | null {
  const playerOne = participants.find((participant) => participant.playerId === match.playerOneId);
  const playerTwo = participants.find((participant) => participant.playerId === match.playerTwoId);

  if (!playerOne || !playerTwo) {
    return null;
  }

  return {
    playerA: match.playerOneId,
    playerB: match.playerTwoId,
    setsWonA: playerOne.setsWon,
    setsWonB: playerTwo.setsWon,
    status: match.status,
  };
}

export function parsePlacementGroupRange(groupName: string): { from: number; to: number } | null {
  const match = /^Placement (\d+)-(\d+)$/.exec(groupName);
  if (!match) {
    return null;
  }

  return {
    from: Number(match[1]),
    to: Number(match[2]),
  };
}

export async function loadMatch(db: DbExecutor, matchId: string): Promise<LoadedMatch | null> {
  const [match] = await db
    .select()
    .from(schema.matches)
    .where(eq(schema.matches.id, matchId))
    .limit(1);

  if (!match) {
    return null;
  }

  const participants = await db
    .select()
    .from(schema.matchParticipants)
    .where(eq(schema.matchParticipants.matchId, matchId));

  return { match, participants };
}

export type ConfirmAuditEventType =
  'MATCH_CONFIRMED' | 'MATCH_CORRECTED' | 'MATCH_ORGANIZER_RECORDED' | 'AUTO_CONFIRMED';

export interface ConfirmedMatchResult {
  match: ReturnType<typeof mapMatch>;
  editionId: string;
  groupId: string;
}

export interface ConfirmMatchResultOptions {
  correctedSets?: {
    playerOneSets: number;
    playerTwoSets: number;
  };
  outcome?: MatchOutcome;
  walkoverAbsentPlayerId?: string;
  auditExtras?: Record<string, unknown>;
}

export async function confirmMatchResult(
  db: DbExecutor,
  matchId: string,
  createdBy: string,
  auditEventType: ConfirmAuditEventType,
  options?: ConfirmMatchResultOptions,
): Promise<ConfirmedMatchResult> {
  const loaded = await loadMatch(db, matchId);
  if (!loaded) {
    throw notFound('Partida não encontrada.');
  }

  const { match, participants } = loaded;

  const [edition] = await db
    .select()
    .from(schema.editions)
    .where(eq(schema.editions.id, match.editionId))
    .limit(1);

  if (!edition) {
    throw notFound('Edição não encontrada.');
  }

  const now = new Date();
  const correctedSets = options?.correctedSets;

  await db.transaction(async (tx) => {
    if (correctedSets) {
      await tx
        .update(schema.matchParticipants)
        .set({ setsWon: correctedSets.playerOneSets })
        .where(
          and(
            eq(schema.matchParticipants.matchId, match.id),
            eq(schema.matchParticipants.playerId, match.playerOneId),
          ),
        );

      await tx
        .update(schema.matchParticipants)
        .set({ setsWon: correctedSets.playerTwoSets })
        .where(
          and(
            eq(schema.matchParticipants.matchId, match.id),
            eq(schema.matchParticipants.playerId, match.playerTwoId),
          ),
        );
    }

    await tx
      .update(schema.matches)
      .set({
        status: 'CONFIRMADA',
        outcome: options?.outcome ?? match.outcome,
        walkoverAbsentPlayerId: options?.walkoverAbsentPlayerId ?? match.walkoverAbsentPlayerId,
        updatedAt: now,
      })
      .where(eq(schema.matches.id, match.id));

    await recalculateGroupStanding(tx, match.groupId, edition.rules);

    if (match.phase === GROUP_PHASE) {
      await maybeGeneratePlacementStage(tx, match.editionId, edition.rules, createdBy);
    } else if (match.phase === PLACEMENT_PHASE) {
      const withdrawnIds = await loadWithdrawnPlayerIds(tx, match.editionId);
      await advanceBracketFourForGroup(tx, match.editionId, match.groupId, withdrawnIds, createdBy);
    }

    const playerOneSets =
      correctedSets?.playerOneSets ??
      participants.find((participant) => participant.playerId === match.playerOneId)?.setsWon;
    const playerTwoSets =
      correctedSets?.playerTwoSets ??
      participants.find((participant) => participant.playerId === match.playerTwoId)?.setsWon;

    await tx.insert(schema.auditEvents).values({
      editionId: match.editionId,
      matchId: match.id,
      eventType: auditEventType,
      payload: {
        groupId: match.groupId,
        phase: match.phase,
        playerOneId: match.playerOneId,
        playerTwoId: match.playerTwoId,
        setsWon: {
          [match.playerOneId]: playerOneSets,
          [match.playerTwoId]: playerTwoSets,
        },
        ...options?.auditExtras,
      },
      createdBy,
    });
  });

  const updated = await loadMatch(db, matchId);
  if (!updated) {
    throw badRequest('Não foi possível confirmar o resultado.');
  }

  return {
    match: mapMatch(updated.match, updated.participants),
    editionId: match.editionId,
    groupId: match.groupId,
  };
}

export async function getResultSubmitter(db: DbExecutor, matchId: string): Promise<string | null> {
  const [event] = await db
    .select({ payload: schema.auditEvents.payload })
    .from(schema.auditEvents)
    .where(
      and(
        eq(schema.auditEvents.matchId, matchId),
        eq(schema.auditEvents.eventType, 'MATCH_RESULT_SUBMITTED'),
      ),
    )
    .orderBy(desc(schema.auditEvents.createdAt))
    .limit(1);

  if (!event || typeof event.payload !== 'object' || event.payload === null) {
    return null;
  }

  const submittedBy = (event.payload as { submittedByPlayerId?: unknown }).submittedByPlayerId;
  return typeof submittedBy === 'string' ? submittedBy : null;
}

export async function recalculateGroupStanding(
  tx: Transaction,
  groupId: string,
  rules: EditionRules,
): Promise<void> {
  const groupMatches = await tx
    .select()
    .from(schema.matches)
    .where(eq(schema.matches.groupId, groupId));

  const matchIds = groupMatches.map((match) => match.id);
  const participants =
    matchIds.length === 0
      ? []
      : await tx
          .select()
          .from(schema.matchParticipants)
          .where(inArray(schema.matchParticipants.matchId, matchIds));

  const participantsByMatchId = new Map<string, ParticipantRow[]>();
  for (const participant of participants) {
    const current = participantsByMatchId.get(participant.matchId) ?? [];
    current.push(participant);
    participantsByMatchId.set(participant.matchId, current);
  }

  const standingMatches = groupMatches
    .map((match) => toStandingMatch(match, participantsByMatchId.get(match.id) ?? []))
    .filter((match): match is StandingMatch => match !== null);

  const entries = calculateGroupStanding(standingMatches, rules);

  await tx.delete(schema.standings).where(eq(schema.standings.groupId, groupId));

  if (entries.length === 0) {
    return;
  }

  await tx.insert(schema.standings).values(
    entries.map((entry) => ({
      groupId,
      playerId: entry.playerId,
      setsWon: entry.setsWon,
      setDiff: entry.setDiff,
      matchesWon: entry.matchesWon,
      rankInGroup: entry.rankInGroup,
    })),
  );
}

export async function isGroupStageComplete(db: DbExecutor, editionId: string): Promise<boolean> {
  const [pendingMatch] = await db
    .select({ id: schema.matches.id })
    .from(schema.matches)
    .where(
      and(
        eq(schema.matches.editionId, editionId),
        eq(schema.matches.phase, GROUP_PHASE),
        ne(schema.matches.status, 'CONFIRMADA'),
        ne(schema.matches.status, 'CANCELADA'),
      ),
    )
    .limit(1);

  return !pendingMatch;
}

export async function loadGroupStandingsInput(
  db: DbExecutor,
  editionId: string,
  phase: string,
): Promise<GroupStandingInput[]> {
  const groups = await db
    .select()
    .from(schema.groups)
    .where(and(eq(schema.groups.editionId, editionId), eq(schema.groups.phase, phase)))
    .orderBy(asc(schema.groups.name));

  const groupIds = groups.map((group) => group.id);
  if (groupIds.length === 0) {
    return [];
  }

  const standingRows = await db
    .select()
    .from(schema.standings)
    .where(inArray(schema.standings.groupId, groupIds))
    .orderBy(asc(schema.standings.rankInGroup));

  const standingsByGroupId = new Map<string, typeof standingRows>();
  for (const standing of standingRows) {
    const current = standingsByGroupId.get(standing.groupId) ?? [];
    current.push(standing);
    standingsByGroupId.set(standing.groupId, current);
  }

  return groups.map((group) => ({
    groupId: group.id,
    standings: (standingsByGroupId.get(group.id) ?? []).map((standing) => ({
      playerId: standing.playerId,
      setsWon: standing.setsWon,
      setDiff: standing.setDiff,
      matchesWon: standing.matchesWon,
      rankInGroup: standing.rankInGroup,
    })),
  }));
}

export async function maybeGeneratePlacementStage(
  tx: Transaction,
  editionId: string,
  rules: EditionRules,
  createdBy: string,
): Promise<boolean> {
  const complete = await isGroupStageComplete(tx, editionId);
  if (!complete) {
    return false;
  }

  const [existingPlacementGroup] = await tx
    .select({ id: schema.groups.id })
    .from(schema.groups)
    .where(and(eq(schema.groups.editionId, editionId), eq(schema.groups.phase, PLACEMENT_PHASE)))
    .limit(1);

  if (existingPlacementGroup) {
    return false;
  }

  const groupStandings = await loadGroupStandingsInput(tx, editionId, GROUP_PHASE);
  const placementGroups = generatePlacementStage(groupStandings, rules);
  let insertedGroups: Array<{ id: string }> = [];

  if (placementGroups.length > 0) {
    insertedGroups = await tx
      .insert(schema.groups)
      .values(
        placementGroups.map((group) => ({
          editionId,
          name: group.name,
          phase: PLACEMENT_PHASE,
          placementFormat: group.format,
          positionFrom: group.positionRange.from,
          positionTo: group.positionRange.to,
        })),
      )
      .returning({ id: schema.groups.id });

    const groupPlayers = placementGroups.flatMap((group, index) => {
      const groupId = insertedGroups[index]?.id;
      if (!groupId) {
        throw conflict('Falha ao persistir os grupos da fase de colocação.');
      }

      return group.playerIds.map((playerId) => ({
        groupId,
        editionId,
        playerId,
        isSeed: false,
      }));
    });

    const placementPlayerIds = [...new Set(groupPlayers.map((entry) => entry.playerId))];
    if (placementPlayerIds.length > 0) {
      await tx
        .delete(schema.groupPlayers)
        .where(
          and(
            eq(schema.groupPlayers.editionId, editionId),
            inArray(schema.groupPlayers.playerId, placementPlayerIds),
          ),
        );
    }

    await tx.insert(schema.groupPlayers).values(groupPlayers);
  }

  await tx
    .update(schema.editions)
    .set({ status: 'FASE_COLOCACAO' })
    .where(eq(schema.editions.id, editionId));

  await tx.insert(schema.auditEvents).values({
    editionId,
    eventType: 'PLACEMENT_STAGE_GENERATED',
    payload: {
      groupCount: placementGroups.length,
      groups: placementGroups.map((group, index) => ({
        groupId: insertedGroups[index]?.id ?? null,
        name: group.name,
        format: group.format,
        positionRange: group.positionRange,
        playerIds: group.playerIds,
      })),
    },
    createdBy,
  });

  return true;
}

export async function buildPlacementGroupResults(
  db: DbExecutor,
  editionId: string,
  rules: EditionRules,
): Promise<PlacementGroupResult[]> {
  const groupStageStandings = await loadGroupStandingsInput(db, editionId, GROUP_PHASE);
  const directPlacements = directPlacementsFromStandings(groupStageStandings);

  const placementGroups = await db
    .select()
    .from(schema.groups)
    .where(and(eq(schema.groups.editionId, editionId), eq(schema.groups.phase, PLACEMENT_PHASE)))
    .orderBy(asc(schema.groups.name));

  const results: PlacementGroupResult[] = directPlacements.map((placement) => ({
    positionRange: { from: placement.position, to: placement.position },
    format: 'round-robin',
    directPlayerId: placement.playerId,
  }));

  for (const group of placementGroups) {
    const range =
      getPlacementGroupRange(group) ?? parsePlacementGroupRange(group.name) ?? undefined;
    if (!range) {
      continue;
    }

    const groupPlayers = await db
      .select({ playerId: schema.groupPlayers.playerId })
      .from(schema.groupPlayers)
      .where(eq(schema.groupPlayers.groupId, group.id));

    const format =
      group.placementFormat ??
      (groupPlayers.length === 4
        ? 'bracket-4'
        : groupPlayers.length >= 3
          ? 'round-robin'
          : 'knockout');

    if (format === 'knockout') {
      const [match] = await db
        .select()
        .from(schema.matches)
        .where(and(eq(schema.matches.groupId, group.id), eq(schema.matches.phase, PLACEMENT_PHASE)))
        .limit(1);

      if (!match || !isMatchCounted(match.status)) {
        throw conflict(`A partida de colocação "${group.name}" ainda não foi confirmada.`);
      }

      const participants = await db
        .select()
        .from(schema.matchParticipants)
        .where(eq(schema.matchParticipants.matchId, match.id));

      const playerOne = participants.find(
        (participant) => participant.playerId === match.playerOneId,
      );
      const playerTwo = participants.find(
        (participant) => participant.playerId === match.playerTwoId,
      );

      if (!playerOne || !playerTwo) {
        throw conflict(`Participantes da partida de colocação "${group.name}" estão incompletos.`);
      }

      const winnerId =
        playerOne.setsWon > playerTwo.setsWon ? match.playerOneId : match.playerTwoId;
      const loserId = winnerId === match.playerOneId ? match.playerTwoId : match.playerOneId;

      results.push({
        positionRange: range,
        format: 'knockout',
        winnerId,
        loserId,
      });
      continue;
    }

    if (format === 'bracket-4') {
      const bracketMatches = await db
        .select()
        .from(schema.matches)
        .where(
          and(eq(schema.matches.groupId, group.id), eq(schema.matches.phase, PLACEMENT_PHASE)),
        );

      const pending = bracketMatches.find((match) => !isMatchCounted(match.status));
      if (pending) {
        throw conflict(`As partidas do grupo "${group.name}" ainda não foram todas confirmadas.`);
      }

      const matchIds = bracketMatches.map((match) => match.id);
      const participants =
        matchIds.length === 0
          ? []
          : await db
              .select()
              .from(schema.matchParticipants)
              .where(inArray(schema.matchParticipants.matchId, matchIds));

      const participantsByMatchId = new Map<string, typeof participants>();
      for (const participant of participants) {
        const current = participantsByMatchId.get(participant.matchId) ?? [];
        current.push(participant);
        participantsByMatchId.set(participant.matchId, current);
      }

      const bracketInputs: BracketMatchInput[] = bracketMatches
        .filter(
          (
            match,
          ): match is typeof match & { bracketRound: NonNullable<typeof match.bracketRound> } =>
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
            confirmed: isMatchCounted(match.status),
          };
        });

      if (bracketInputs.length < 2) {
        throw conflict(`O bracket do grupo "${group.name}" está incompleto.`);
      }

      const withdrawn = await loadWithdrawnPlayers(db, editionId);
      const bandWithdrawn = withdrawn.filter((entry) =>
        groupPlayers.some((player) => player.playerId === entry.playerId),
      );

      const state = buildBracketFourState(bracketInputs);
      const orderedPlayerIds = resolveBracketFourPositions(state, range, bandWithdrawn);

      results.push({
        positionRange: range,
        format: 'bracket-4',
        orderedPlayerIds,
      });
      continue;
    }

    const standingRows = await db
      .select()
      .from(schema.standings)
      .where(eq(schema.standings.groupId, group.id))
      .orderBy(asc(schema.standings.rankInGroup));

    const groupMatches = await db
      .select()
      .from(schema.matches)
      .where(and(eq(schema.matches.groupId, group.id), eq(schema.matches.phase, PLACEMENT_PHASE)));

    const pendingMatches = groupMatches.filter(
      (match) => !isMatchCounted(match.status) && match.status !== 'CANCELADA',
    );
    if (pendingMatches.length > 0) {
      throw conflict(`As partidas do grupo "${group.name}" ainda não foram todas confirmadas.`);
    }

    if (groupPlayers.length === 3) {
      const withdrawn = await loadWithdrawnPlayers(db, editionId);
      const withdrawnInBand = withdrawn.find((entry) =>
        groupPlayers.some((player) => player.playerId === entry.playerId),
      );

      if (withdrawnInBand) {
        const matchIds = groupMatches.map((match) => match.id);
        const participants =
          matchIds.length === 0
            ? []
            : await db
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
          playerIds: groupPlayers.map((player) => player.playerId),
          withdrawnPlayerId: withdrawnInBand.playerId,
          matches: standingMatches,
          positionRange: range,
        });

        const decisiveMatch = groupMatches.find(
          (match) =>
            isMatchCounted(match.status) &&
            ((match.playerOneId === resolution.decisiveMatch?.playerA &&
              match.playerTwoId === resolution.decisiveMatch.playerB) ||
              (match.playerOneId === resolution.decisiveMatch?.playerB &&
                match.playerTwoId === resolution.decisiveMatch.playerA)),
        );

        let decisiveWinnerId: string | undefined;
        if (decisiveMatch) {
          const participants = await db
            .select()
            .from(schema.matchParticipants)
            .where(eq(schema.matchParticipants.matchId, decisiveMatch.id));
          const playerOne = participants.find((row) => row.playerId === decisiveMatch.playerOneId);
          const playerTwo = participants.find((row) => row.playerId === decisiveMatch.playerTwoId);
          if (playerOne && playerTwo) {
            decisiveWinnerId =
              playerOne.setsWon > playerTwo.setsWon
                ? decisiveMatch.playerOneId
                : decisiveMatch.playerTwoId;
          }
        }

        const assigned = assignMinigroupPositions(resolution, range, decisiveWinnerId);
        results.push({
          positionRange: range,
          format: 'round-robin',
          orderedPlayerIds: assigned
            .sort((left, right) => left.position - right.position)
            .map((entry) => entry.playerId),
        });
        continue;
      }
    }

    if (standingRows.length !== groupPlayers.length) {
      throw conflict(`A classificação do grupo "${group.name}" ainda não está completa.`);
    }

    results.push({
      positionRange: range,
      format: 'round-robin',
      orderedPlayerIds: standingRows.map((standing) => standing.playerId),
    });
  }

  return results;
}

export function validateSubmittedScore(setsWonByReporter: number, setsWonByOpponent: number) {
  return validateMatchResult({
    setsWonByReporter,
    setsWonByOpponent,
  });
}

export function validateCorrectedScore(setsWonByPlayerOne: number, setsWonByPlayerTwo: number) {
  return validateMatchResult({
    setsWonByReporter: setsWonByPlayerOne,
    setsWonByOpponent: setsWonByPlayerTwo,
  });
}

export function isMatchCounted(status: MatchStatus): boolean {
  return COUNTED_MATCH_STATUSES.has(status);
}

export async function countEditionRegistrations(
  db: DbExecutor,
  editionId: string,
): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(schema.editionRegistrations)
    .where(eq(schema.editionRegistrations.editionId, editionId));

  return result?.count ?? 0;
}

const EDITION_NOT_STARTED_STATUSES: EditionStatus[] = [
  'RASCUNHO',
  'INSCRICOES_ABERTAS',
  'SORTEIO_PUBLICADO',
];

export interface EditionForFinalizeCheck {
  id: string;
  status: EditionStatus;
}

export async function getEditionFinalizeBlockers(
  db: DbExecutor,
  edition: EditionForFinalizeCheck,
): Promise<string[]> {
  const blockers: string[] = [];

  if (EDITION_NOT_STARTED_STATUSES.includes(edition.status)) {
    if (edition.status === 'SORTEIO_PUBLICADO') {
      blockers.push('Gere as partidas antes de encerrar a edição.');
    } else {
      blockers.push('O torneio ainda não foi iniciado.');
    }
    return blockers;
  }

  const matchRows = await db
    .select({ status: schema.matches.status })
    .from(schema.matches)
    .where(eq(schema.matches.editionId, edition.id));

  const pendingCount = matchRows.filter(
    (row) => !isMatchResolvedForEditionClose(row.status),
  ).length;

  if (pendingCount > 0) {
    blockers.push(`Ainda há ${pendingCount} partida(s) sem resultado confirmado.`);
  }

  if (edition.status === 'FASE_COLOCACAO') {
    const placementGroups = await db
      .select({ id: schema.groups.id })
      .from(schema.groups)
      .where(
        and(eq(schema.groups.editionId, edition.id), eq(schema.groups.phase, PLACEMENT_PHASE)),
      );

    if (placementGroups.length > 0) {
      const [existingPlacementMatch] = await db
        .select({ id: schema.matches.id })
        .from(schema.matches)
        .where(
          and(
            eq(schema.matches.editionId, edition.id),
            eq(schema.matches.phase, PLACEMENT_PHASE),
            ne(schema.matches.status, 'CANCELADA'),
          ),
        )
        .limit(1);

      if (!existingPlacementMatch) {
        blockers.push('Publique a fase de colocação antes de encerrar.');
      }
    }
  }

  return blockers;
}

export async function assertEditionReadyToFinalize(
  db: DbExecutor,
  edition: EditionForFinalizeCheck,
): Promise<void> {
  const blockers = await getEditionFinalizeBlockers(db, edition);
  if (blockers.length > 0) {
    throw conflict(blockers[0]!);
  }
}

export async function finalizeEditionPlacements(
  db: DbExecutor,
  editionId: string,
  championshipId: string,
  scoringTable: Parameters<typeof attachScoringPoints>[1],
  rules: EditionRules,
) {
  const placementResults = await buildPlacementGroupResults(db, editionId, rules);
  const finalStanding = calculateFinalStanding(placementResults);
  const withPoints = attachScoringPoints(finalStanding, scoringTable);

  await db.delete(schema.finalPlacements).where(eq(schema.finalPlacements.editionId, editionId));

  if (withPoints.length > 0) {
    await db.insert(schema.finalPlacements).values(
      withPoints.map((entry) => ({
        editionId,
        playerId: entry.playerId,
        position: entry.position,
        pointsAwarded: entry.pointsAwarded,
      })),
    );

    for (const entry of withPoints) {
      const [existing] = await db
        .select({ accumulatedPoints: schema.championshipPlayerPoints.accumulatedPoints })
        .from(schema.championshipPlayerPoints)
        .where(
          and(
            eq(schema.championshipPlayerPoints.championshipId, championshipId),
            eq(schema.championshipPlayerPoints.playerId, entry.playerId),
          ),
        )
        .limit(1);

      if (existing) {
        await db
          .update(schema.championshipPlayerPoints)
          .set({
            accumulatedPoints: existing.accumulatedPoints + entry.pointsAwarded,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.championshipPlayerPoints.championshipId, championshipId),
              eq(schema.championshipPlayerPoints.playerId, entry.playerId),
            ),
          );
      } else {
        await db.insert(schema.championshipPlayerPoints).values({
          championshipId,
          playerId: entry.playerId,
          accumulatedPoints: entry.pointsAwarded,
        });
      }
    }
  }

  const [updatedEdition] = await db
    .update(schema.editions)
    .set({ status: 'ENCERRADA' })
    .where(eq(schema.editions.id, editionId))
    .returning();

  return {
    edition: updatedEdition,
    placements: withPoints,
    championshipId,
  };
}

export function buildPlacementMatchesForGroup(playerIds: string[]): Array<{
  playerOneId: string;
  playerTwoId: string;
}> {
  return generateGroupMatches({ playerIds }).map((match) => ({
    playerOneId: match.playerA < match.playerB ? match.playerA : match.playerB,
    playerTwoId: match.playerA < match.playerB ? match.playerB : match.playerA,
  }));
}
