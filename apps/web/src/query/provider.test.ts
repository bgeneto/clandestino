import { describe, expect, it } from 'vitest';
import { shouldPersistOfflineQuery } from './persistence-policy.js';

describe('query persistence policy', () => {
  it('persiste somente dados necessários para a edição offline', () => {
    expect(
      shouldPersistOfflineQuery({
        queryKey: ['matches', 'edition-id'],
        state: { status: 'success' },
      }),
    ).toBe(true);
    expect(
      shouldPersistOfflineQuery({
        queryKey: ['championship-editions', 'championship-id'],
        state: { status: 'success' },
      }),
    ).toBe(false);
  });
});
