import type { NotificationApi, NotificationOptions } from './types.js';
import { ApiError } from '../lib/api-client.js';

export function notifyApiError(notify: NotificationApi, error: unknown, fallback: string): void {
  notify.danger(error instanceof ApiError ? error.message : fallback);
}
