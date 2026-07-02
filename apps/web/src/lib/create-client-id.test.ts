import { describe, expect, it } from 'vitest';
import { createClientId } from './create-client-id.js';

describe('createClientId', () => {
  it('returns unique ids without crypto.randomUUID', () => {
    const original = globalThis.crypto?.randomUUID;
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {},
    });

    try {
      const first = createClientId('test');
      const second = createClientId('test');
      expect(first).not.toBe(second);
      expect(first.startsWith('test-')).toBe(true);
    } finally {
      Object.defineProperty(globalThis, 'crypto', {
        configurable: true,
        value: { randomUUID: original },
      });
    }
  });
});
