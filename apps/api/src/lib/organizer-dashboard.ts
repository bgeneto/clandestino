import type { EditionStatus, OrganizerActiveEdition } from '@clandestino/shared-contracts';
import { and, count, eq, inArray, isNull, ne, or } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { schema } from '../db/index.js';
import { PLACEMENT_PHASE } from './matches.js';

type DbExecutor = Pick<FastifyInstance['db'], 'select'>;

export interface OrganizerEditionActionInput {
  status: EditionStatus;
  contestedMatchCount: number;
  pendingMatchCount: number;
  placementGroupCount: number;
}

export interface OrganizerEditionAction {
  needsOrganizerAction: boolean;
  actionLabel: string | null;
}

export function deriveOrganizerEditionAction(
  input: OrganizerEditionActionInput,
): OrganizerEditionAction {
  if (input.contestedMatchCount > 0) {
    return { needsOrganizerAction: true, actionLabel: 'Resolver contestação' };
  }

  if (input.pendingMatchCount > 0) {
    return { needsOrganizerAction: true, actionLabel: 'Resultados' };
  }

  switch (input.status) {
    case 'RASCUNHO':
    case 'INSCRICOES_ABERTAS':
      return { needsOrganizerAction: true, actionLabel: 'Configurar edição' };
    case 'SORTEIO_PUBLICADO':
      return { needsOrganizerAction: true, actionLabel: 'Gerar partidas' };
    case 'FASE_COLOCACAO':
      return {
        needsOrganizerAction: true,
        actionLabel:
          input.placementGroupCount > 0 ? 'Publicar fase de colocação' : 'Encerrar edição',
      };
    case 'EM_ANDAMENTO':
      return { needsOrganizerAction: false, actionLabel: null };
    default:
      return { needsOrganizerAction: false, actionLabel: null };
  }
}

export function sortOrganizerActiveEditions(
  editions: OrganizerActiveEdition[],
): OrganizerActiveEdition[] {
  return [...editions].sort((left, right) => {
    if (left.needsOrganizerAction !== right.needsOrganizerAction) {
      return left.needsOrganizerAction ? -1 : 1;
    }

    const dateCompare = right.date.localeCompare(left.date);
    if (dateCompare !== 0) {
      return dateCompare;
    }

    return right.name.localeCompare(left.name, 'pt-BR');
  });
}

function countByEditionId(rows: Array<{ editionId: string; count: number }>): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.editionId, row.count);
  }
  return map;
}

export async function loadOrganizerActiveEditions(
  db: DbExecutor,
): Promise<OrganizerActiveEdition[]> {
  const editionRows = await db
    .select({
      id: schema.editions.id,
      championshipId: schema.editions.championshipId,
      championshipName: schema.championships.name,
      name: schema.editions.name,
      date: schema.editions.date,
      status: schema.editions.status,
    })
    .from(schema.editions)
    .innerJoin(schema.championships, eq(schema.editions.championshipId, schema.championships.id))
    .where(and(ne(schema.editions.status, 'ENCERRADA'), isNull(schema.championships.archivedAt)));

  if (editionRows.length === 0) {
    return [];
  }

  const editionIds = editionRows.map((row) => row.id);

  const contestedRows = await db
    .select({
      editionId: schema.matches.editionId,
      count: count(),
    })
    .from(schema.matches)
    .where(
      and(inArray(schema.matches.editionId, editionIds), eq(schema.matches.status, 'CONTESTADA')),
    )
    .groupBy(schema.matches.editionId);

  const pendingRows = await db
    .select({
      editionId: schema.matches.editionId,
      count: count(),
    })
    .from(schema.matches)
    .where(
      and(
        inArray(schema.matches.editionId, editionIds),
        or(
          eq(schema.matches.status, 'AGENDADA'),
          eq(schema.matches.status, 'AGUARDANDO_CONFIRMACAO'),
        ),
      ),
    )
    .groupBy(schema.matches.editionId);

  const placementRows = await db
    .select({
      editionId: schema.groups.editionId,
      count: count(),
    })
    .from(schema.groups)
    .where(
      and(inArray(schema.groups.editionId, editionIds), eq(schema.groups.phase, PLACEMENT_PHASE)),
    )
    .groupBy(schema.groups.editionId);

  const contestedByEditionId = countByEditionId(contestedRows);
  const pendingByEditionId = countByEditionId(pendingRows);
  const placementByEditionId = countByEditionId(placementRows);

  const editions = editionRows.map((row) => {
    const contestedMatchCount = contestedByEditionId.get(row.id) ?? 0;
    const pendingMatchCount = pendingByEditionId.get(row.id) ?? 0;
    const placementGroupCount = placementByEditionId.get(row.id) ?? 0;
    const action = deriveOrganizerEditionAction({
      status: row.status,
      contestedMatchCount,
      pendingMatchCount,
      placementGroupCount,
    });

    return {
      id: row.id,
      championshipId: row.championshipId,
      championshipName: row.championshipName,
      name: row.name,
      date: row.date,
      status: row.status,
      contestedMatchCount,
      placementGroupCount,
      needsOrganizerAction: action.needsOrganizerAction,
      actionLabel: action.actionLabel,
    };
  });

  return sortOrganizerActiveEditions(editions);
}
