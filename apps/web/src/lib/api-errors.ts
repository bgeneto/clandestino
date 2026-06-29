import { ApiError } from './api-client.js';

export function isClientError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status >= 400 && error.status < 500;
}

export function isEditionGone(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export function shouldUseOfflineCache(error: unknown): boolean {
  if (isClientError(error)) {
    return false;
  }

  return true;
}
