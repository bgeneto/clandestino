import { createHash, randomBytes } from 'node:crypto';

export function generateSecureToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isOrganizerEmailAllowed(email: string, allowedEmails: readonly string[]): boolean {
  const normalized = normalizeEmail(email);
  return allowedEmails.some((allowed) => normalizeEmail(allowed) === normalized);
}
