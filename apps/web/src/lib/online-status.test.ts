import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getOnlineStatus,
  probeApiReachability,
  refreshOnlineStatus,
  resetOnlineStatusForTests,
  startOnlineStatusMonitor,
  subscribeOnlineStatus,
} from './online-status.js';

afterEach(() => {
  resetOnlineStatusForTests(true);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('probeApiReachability', () => {
  it('retorna true quando /health responde ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    await expect(probeApiReachability(fetchImpl)).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/health',
      expect.objectContaining({ method: 'GET', cache: 'no-store' }),
    );
  });

  it('retorna false quando a rede falha', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(probeApiReachability(fetchImpl)).resolves.toBe(false);
  });

  it('retorna false quando /health não está ok', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false });
    await expect(probeApiReachability(fetchImpl)).resolves.toBe(false);
  });
});

describe('online status monitor', () => {
  it('corrige navigator.onLine falso após probe bem-sucedido', async () => {
    resetOnlineStatusForTests(false);
    expect(getOnlineStatus()).toBe(false);

    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const seen: boolean[] = [];
    const unsubscribe = subscribeOnlineStatus((online) => {
      seen.push(online);
    });

    startOnlineStatusMonitor(fetchImpl);
    await vi.waitFor(() => {
      expect(getOnlineStatus()).toBe(true);
    });

    expect(seen).toEqual([true]);
    unsubscribe();
  });

  it('marca offline no evento offline do browser e ignora probe atrasado', async () => {
    resetOnlineStatusForTests(true);
    let resolveProbe: (value: { ok: boolean }) => void = () => undefined;
    const fetchImpl = vi.fn().mockImplementation(
      () =>
        new Promise<{ ok: boolean }>((resolve) => {
          resolveProbe = resolve;
        }),
    );
    startOnlineStatusMonitor(fetchImpl);

    window.dispatchEvent(new Event('offline'));
    expect(getOnlineStatus()).toBe(false);

    resolveProbe({ ok: true });
    await Promise.resolve();
    await Promise.resolve();

    expect(getOnlineStatus()).toBe(false);
  });

  it('revalida com probe no evento online', async () => {
    resetOnlineStatusForTests(false);
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    startOnlineStatusMonitor(fetchImpl);

    await vi.waitFor(() => expect(getOnlineStatus()).toBe(true));
    fetchImpl.mockClear();

    window.dispatchEvent(new Event('offline'));
    expect(getOnlineStatus()).toBe(false);

    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(getOnlineStatus()).toBe(true));
    expect(fetchImpl).toHaveBeenCalled();
  });

  it('deduplica probes concorrentes', async () => {
    const fetchImpl = vi.fn().mockImplementation(
      () =>
        new Promise<{ ok: boolean }>((resolve) => {
          setTimeout(() => resolve({ ok: true }), 20);
        }),
    );

    const [a, b] = await Promise.all([
      refreshOnlineStatus(fetchImpl),
      refreshOnlineStatus(fetchImpl),
    ]);

    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
