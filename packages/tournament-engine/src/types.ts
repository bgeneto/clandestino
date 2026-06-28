import type { MatchStatus, RankingCriterion, TournamentRules } from '@clandestino/shared-contracts';

export interface GroupConfiguration {
  groupCount: number;
  groupSizes: number[];
}

export interface SeedAssignment {
  groupIndex: number;
  playerId: string;
}

export interface DrawGroupPlayer {
  playerId: string;
  isSeed: boolean;
}

export interface DrawGroupInput {
  index: number;
  players: DrawGroupPlayer[];
  targetSize: number;
}

export interface GroupMatch {
  playerA: string;
  playerB: string;
}

export interface GroupForMatches {
  playerIds: string[];
}

export interface MatchResultInput {
  setsWonByReporter: number;
  setsWonByOpponent: number;
}

export type MatchValidationResult = { valid: true } | { valid: false; reason: string };

export interface StandingMatch {
  playerA: string;
  playerB: string;
  setsWonA: number;
  setsWonB: number;
  status: MatchStatus;
}

export interface PlayerMatchStats {
  playerId: string;
  setsWon: number;
  setsLost: number;
  setDiff: number;
  matchesWon: number;
  matchesPlayed: number;
}

export interface GroupStandingEntry {
  playerId: string;
  setsWon: number;
  setDiff: number;
  matchesWon: number;
  rankInGroup: number;
}

export interface GroupStandingInput {
  groupId: string;
  standings: GroupStandingEntry[];
}

export interface PlacementStageGroup {
  name: string;
  format: 'round-robin' | 'knockout';
  playerIds: string[];
  positionRange: { from: number; to: number };
}

export interface PlacementGroupResult {
  positionRange: { from: number; to: number };
  format: 'round-robin' | 'knockout';
  orderedPlayerIds?: string[];
  winnerId?: string;
  loserId?: string;
  directPlayerId?: string;
}

export interface FinalStandingEntry {
  playerId: string;
  position: number;
}

export const COUNTED_MATCH_STATUSES = new Set<MatchStatus>(['CONFIRMADA', 'CORRIGIDA']);

export type { RankingCriterion, TournamentRules };
