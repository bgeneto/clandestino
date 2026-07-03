import type { EditionStatus, EditionSummary } from '@clandestino/shared-contracts';

const LIVE_EDITION_STATUSES: ReadonlySet<EditionStatus> = new Set([
  'INSCRICOES_ABERTAS',
  'SORTEIO_PUBLICADO',
  'EM_ANDAMENTO',
  'FASE_COLOCACAO',
]);

export function isPublishedEdition(status: EditionStatus): boolean {
  return status !== 'RASCUNHO';
}

export function isLiveEdition(status: EditionStatus): boolean {
  return LIVE_EDITION_STATUSES.has(status);
}

export function filterPublishedEditions(editions: EditionSummary[]): EditionSummary[] {
  return editions.filter((edition) => isPublishedEdition(edition.status));
}

export function partitionPublishedEditions(editions: EditionSummary[]): {
  live: EditionSummary[];
  finished: EditionSummary[];
} {
  const published = filterPublishedEditions(editions);
  const live: EditionSummary[] = [];
  const finished: EditionSummary[] = [];

  for (const edition of published) {
    if (isLiveEdition(edition.status)) {
      live.push(edition);
    } else {
      finished.push(edition);
    }
  }

  return { live, finished };
}
