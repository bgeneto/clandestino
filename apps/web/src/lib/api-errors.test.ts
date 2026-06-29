import { describe, expect, it } from 'vitest';
import { ApiError } from './api-client.js';
import { isClientError, isEditionGone, shouldUseOfflineCache } from './api-errors.js';

describe('api-errors', () => {
  it('identifica erro de cliente 4xx', () => {
    expect(isClientError(new ApiError('bad', 400))).toBe(true);
    expect(isClientError(new ApiError('gone', 404))).toBe(true);
    expect(isClientError(new ApiError('server', 500))).toBe(false);
    expect(isClientError(new TypeError('network'))).toBe(false);
  });

  it('identifica edição removida (404)', () => {
    expect(isEditionGone(new ApiError('gone', 404))).toBe(true);
    expect(isEditionGone(new ApiError('server', 500))).toBe(false);
  });

  it('decide uso de cache offline', () => {
    expect(shouldUseOfflineCache(new ApiError('gone', 404))).toBe(false);
    expect(shouldUseOfflineCache(new ApiError('forbidden', 403))).toBe(false);
    expect(shouldUseOfflineCache(new ApiError('server', 500))).toBe(true);
    expect(shouldUseOfflineCache(new TypeError('network'))).toBe(true);
  });
});
