import { describe, expect, it } from 'vitest';
import { buildEditionEntryUrl } from './edition-entry-url.js';

describe('buildEditionEntryUrl', () => {
  it('builds entry URL from current origin', () => {
    expect(buildEditionEntryUrl('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toBe(
      `${window.location.origin}/edicao/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/entrar`,
    );
  });
});
