import type {
  DrawSnapshot,
  Edition,
  EditionRegistration,
  FinalPlacement,
  Group,
  GroupPlayer,
  GroupWithPlayers,
  Match,
  MatchParticipant,
  Player,
  Season,
  Standing,
} from '@clandestino/shared-contracts';
import type { InferSelectModel } from 'drizzle-orm';
import type {
  drawSnapshots,
  editionRegistrations,
  editions,
  finalPlacements,
  groupPlayers,
  groups,
  matchParticipants,
  matches,
  players,
  seasons,
  standings,
} from '../db/schema.js';

type PlayerRow = InferSelectModel<typeof players>;
type SeasonRow = InferSelectModel<typeof seasons>;
type EditionRow = InferSelectModel<typeof editions>;
type RegistrationRow = InferSelectModel<typeof editionRegistrations>;
type GroupRow = InferSelectModel<typeof groups>;
type GroupPlayerRow = InferSelectModel<typeof groupPlayers>;
type DrawSnapshotRow = InferSelectModel<typeof drawSnapshots>;
type MatchRow = InferSelectModel<typeof matches>;
type MatchParticipantRow = InferSelectModel<typeof matchParticipants>;
type StandingRow = InferSelectModel<typeof standings>;
type FinalPlacementRow = InferSelectModel<typeof finalPlacements>;

export function toIsoDateTime(value: Date): string {
  return value.toISOString();
}

export function toIsoDate(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value;
}

export function mapPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    name: row.name,
    createdAt: toIsoDateTime(row.createdAt),
  };
}

export function mapSeason(row: SeasonRow): Season {
  return {
    id: row.id,
    name: row.name,
    scoringTable: row.scoringTable,
    createdAt: toIsoDateTime(row.createdAt),
  };
}

export function mapEdition(row: EditionRow): Edition {
  return {
    id: row.id,
    seasonId: row.seasonId,
    name: row.name,
    date: toIsoDate(row.date),
    rules: row.rules,
    status: row.status,
    autoConfirmMinutes: row.autoConfirmMinutes,
    createdAt: toIsoDateTime(row.createdAt),
  };
}

export function mapRegistration(row: RegistrationRow): EditionRegistration {
  return {
    editionId: row.editionId,
    playerId: row.playerId,
    registeredAt: toIsoDateTime(row.registeredAt),
  };
}

export function mapGroup(row: GroupRow): Group {
  return {
    id: row.id,
    editionId: row.editionId,
    name: row.name,
    phase: row.phase,
  };
}

export function mapGroupPlayer(row: GroupPlayerRow): GroupPlayer {
  return {
    groupId: row.groupId,
    playerId: row.playerId,
    isSeed: row.isSeed,
  };
}

export function mapGroupWithPlayers(group: GroupRow, players: GroupPlayerRow[]): GroupWithPlayers {
  return {
    group: mapGroup(group),
    players: players.map(mapGroupPlayer),
  };
}

export function mapDrawSnapshot(row: DrawSnapshotRow): DrawSnapshot {
  return {
    id: row.id,
    editionId: row.editionId,
    playerId: row.playerId,
    accumulatedPoints: row.accumulatedPoints,
    rankPosition: row.rankPosition,
    isSeed: row.isSeed,
    algorithm: row.algorithm,
    randomSeed: row.randomSeed,
    drawnAt: toIsoDateTime(row.drawnAt),
    drawnBy: row.drawnBy,
  };
}

export function mapMatchParticipant(row: MatchParticipantRow): MatchParticipant {
  return {
    playerId: row.playerId,
    setsWon: row.setsWon,
  };
}

export function mapMatch(
  row: MatchRow,
  participants: MatchParticipantRow[],
  options?: { resultSubmittedByPlayerId?: string },
): Match {
  return {
    id: row.id,
    editionId: row.editionId,
    groupId: row.groupId,
    status: row.status,
    bestOf: row.bestOf as 3 | 5,
    participants: participants.map(mapMatchParticipant),
    ...(options?.resultSubmittedByPlayerId
      ? { resultSubmittedByPlayerId: options.resultSubmittedByPlayerId }
      : {}),
    createdAt: toIsoDateTime(row.createdAt),
    updatedAt: toIsoDateTime(row.updatedAt),
  };
}

export function mapStanding(row: StandingRow): Standing {
  return {
    id: row.id,
    groupId: row.groupId,
    playerId: row.playerId,
    setsWon: row.setsWon,
    setDiff: row.setDiff,
    matchesWon: row.matchesWon,
    rankInGroup: row.rankInGroup,
  };
}

export function mapFinalPlacement(row: FinalPlacementRow): FinalPlacement {
  return {
    id: row.id,
    editionId: row.editionId,
    playerId: row.playerId,
    position: row.position,
    pointsAwarded: row.pointsAwarded,
  };
}
