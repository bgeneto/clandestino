import { describe, expect, it } from 'vitest';
import { createAppQueryClient } from './query-client.js';

describe('app query client', () => {
  it('invalida consultas inativas após qualquer mutação bem-sucedida', async () => {
    const client = createAppQueryClient();
    const queryKey = ['championship-editions', 'championship-id'] as const;
    client.setQueryData(queryKey, { editions: [] });

    const mutation = client.getMutationCache().build(client, {
      mutationFn: async () => ({ ok: true }),
    });
    await mutation.execute(undefined);

    expect(client.getQueryState(queryKey)?.isInvalidated).toBe(true);
    client.clear();
  });
});
