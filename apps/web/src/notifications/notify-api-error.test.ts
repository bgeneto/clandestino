import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api-client.js';
import { notifyApiError } from './notify-api-error.js';
import type { NotificationApi } from './types.js';

describe('notifyApiError', () => {
  it('uses ApiError message when available', () => {
    const notify: NotificationApi = {
      success: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
      danger: vi.fn(),
      dismiss: vi.fn(),
    };

    notifyApiError(notify, new ApiError('Conflito de data.', 409), 'Fallback');
    expect(notify.danger).toHaveBeenCalledWith('Conflito de data.');
  });

  it('falls back for unknown errors', () => {
    const notify: NotificationApi = {
      success: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
      danger: vi.fn(),
      dismiss: vi.fn(),
    };

    notifyApiError(notify, new Error('boom'), 'Não foi possível criar a edição.');
    expect(notify.danger).toHaveBeenCalledWith('Não foi possível criar a edição.');
  });
});
