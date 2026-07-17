import { afterEach, describe, expect, it, vi } from 'vitest';
import { onlineManager } from '@tanstack/react-query';
import {
  getOnlineStatus,
  refreshOnlineStatus,
  resetOnlineStatusForTests,
} from '../lib/online-status.js';
import {
  resetReactQueryOnlineManagerSyncForTests,
  syncReactQueryOnlineManager,
} from './sync-online-manager.js';

afterEach(() => {
  resetOnlineStatusForTests(true);
  resetReactQueryOnlineManagerSyncForTests();
  onlineManager.setOnline(true);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('syncReactQueryOnlineManager', () => {
  it('propaga recuperação via probe para o onlineManager do React Query', async () => {
    resetOnlineStatusForTests(false);
    onlineManager.setOnline(false);
    expect(getOnlineStatus()).toBe(false);
    expect(onlineManager.isOnline()).toBe(false);

    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    syncReactQueryOnlineManager(fetchImpl);

    await refreshOnlineStatus(fetchImpl);

    expect(getOnlineStatus()).toBe(true);
    expect(onlineManager.isOnline()).toBe(true);
  });

  it('é idempotente', () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    syncReactQueryOnlineManager(fetchImpl);
    syncReactQueryOnlineManager(fetchImpl);
    expect(fetchImpl).toHaveBeenCalled();
  });
});
