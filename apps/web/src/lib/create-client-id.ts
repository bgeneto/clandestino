let sequence = 0;

export function createClientId(prefix = 'id'): string {
  const cryptoApi = globalThis.crypto;

  if (cryptoApi !== undefined && typeof cryptoApi.randomUUID === 'function') {
    try {
      return cryptoApi.randomUUID();
    } catch {
      // randomUUID throws outside secure contexts (e.g. http://clandestino.test).
    }
  }

  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence.toString(36)}`;
}
