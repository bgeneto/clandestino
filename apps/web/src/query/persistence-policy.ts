export const QUERY_CACHE_BUSTER = 'network-only-api-v1';

const OFFLINE_QUERY_ROOTS = new Set([
  'edition',
  'participants',
  'groups',
  'standings',
  'matches',
  'player',
]);

export function shouldPersistOfflineQuery(query: {
  queryKey: readonly unknown[];
  state: { status: string };
}): boolean {
  const root = query.queryKey[0];
  return (
    query.state.status === 'success' && typeof root === 'string' && OFFLINE_QUERY_ROOTS.has(root)
  );
}
