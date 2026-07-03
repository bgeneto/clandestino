import type {
  Edition,
  EditionGroupsResponse,
  EditionParticipant,
  EditionStandingsResponse,
  Match,
  SubmitMatchResultBody,
} from '@clandestino/shared-contracts';
import Dexie, { type EntityTable } from 'dexie';

export const SESSION_ROW_ID = 'current';

export const ORGANIZER_SESSION_ROW_ID = 'current';

export type OrganizerSession = {
  id: typeof ORGANIZER_SESSION_ROW_ID;
  sessionToken: string;
  email: string;
  expiresAt: string;
  updatedAt: string;
};

export type OutboxStatus = 'AGUARDANDO_SINCRONIZACAO' | 'SINCRONIZANDO' | 'FALHA';

export type OutboxKind = 'SUBMIT_MATCH_RESULT';

export type OutboxEntry = {
  id: string;
  kind: OutboxKind;
  matchId: string;
  payload: SubmitMatchResultBody;
  status: OutboxStatus;
  createdAt: string;
  lastError?: string;
  attemptCount: number;
};

export type PlayerSession = {
  id: typeof SESSION_ROW_ID;
  playerId: string;
  editionId: string;
  playerName?: string;
  updatedAt: string;
};

export type CachedEdition = {
  id: string;
  edition: Edition;
  cachedAt: string;
};

export type CachedGroups = {
  id: string;
  editionId: string;
  groups: EditionGroupsResponse;
  cachedAt: string;
};

export type CachedMatch = {
  id: string;
  editionId: string;
  match: Match;
  cachedAt: string;
};

export type CachedStanding = {
  id: string;
  editionId: string;
  groupId: string;
  standings: EditionStandingsResponse;
  cachedAt: string;
};

export type CachedParticipants = {
  id: string;
  editionId: string;
  participants: EditionParticipant[];
  cachedAt: string;
};

export type QueryCacheRow = {
  key: string;
  value: string;
  updatedAt: string;
};

export type WizardDraftSyncStatus =
  'RASCUNHO_LOCAL' | 'PRONTO_PARA_SINCRONIZAR' | 'SINCRONIZANDO' | 'SINCRONIZADO' | 'ERRO';

export type WizardDraftPlayer = {
  playerId: string;
  playerName: string;
  accumulatedPoints: number;
  isNew?: boolean;
};

export type WizardDrawPreviewGroup = {
  name: string;
  players: Array<{ playerId: string; playerName: string; isSeed: boolean }>;
};

export type EditionWizardDraft = {
  id: string;
  championshipId: string;
  editionId?: string;
  predictedEditionName: string;
  date: string;
  autoConfirmMinutes: number;
  currentStep: number;
  checkedInPlayers: WizardDraftPlayer[];
  groupCount?: number;
  groupSizes?: number[];
  seedPlayerIds?: string[];
  drawRandomSeed?: string;
  drawPreview?: WizardDrawPreviewGroup[];
  drawInputFingerprint?: string;
  syncStatus: WizardDraftSyncStatus;
  syncError?: string;
  updatedAt: string;
};

export class ClandestinoDatabase extends Dexie {
  session!: EntityTable<PlayerSession, 'id'>;
  organizerSession!: EntityTable<OrganizerSession, 'id'>;
  edition!: EntityTable<CachedEdition, 'id'>;
  groups!: EntityTable<CachedGroups, 'id'>;
  matches!: EntityTable<CachedMatch, 'id'>;
  standing!: EntityTable<CachedStanding, 'id'>;
  participants!: EntityTable<CachedParticipants, 'id'>;
  outbox!: EntityTable<OutboxEntry, 'id'>;
  queryCache!: EntityTable<QueryCacheRow, 'key'>;
  editionWizardDraft!: EntityTable<EditionWizardDraft, 'id'>;

  constructor(name = 'clandestino') {
    super(name);

    this.version(1).stores({
      session: 'id',
      edition: 'id',
      groups: 'id, editionId',
      matches: 'id, editionId',
      standing: 'id, editionId, groupId',
      outbox: 'id, status, createdAt, matchId',
      queryCache: 'key',
    });

    this.version(2).stores({
      organizerSession: 'id',
    });

    this.version(3).stores({
      editionWizardDraft: 'id, championshipId, editionId, syncStatus, updatedAt',
    });

    this.version(4).stores({
      participants: 'id, editionId',
    });
  }
}

let dbInstance: ClandestinoDatabase | undefined;

export function getDb(): ClandestinoDatabase {
  if (!dbInstance) {
    dbInstance = new ClandestinoDatabase();
  }

  return dbInstance;
}

export const db = getDb();
