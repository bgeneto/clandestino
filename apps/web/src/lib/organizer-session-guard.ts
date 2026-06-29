import { clearOrganizerSession } from './organizer-session.js';

const ORGANIZER_LOGIN_PATH = '/organizador';
const ORGANIZER_VERIFY_PATH = '/organizador/entrar';

export async function invalidateOrganizerSession(redirect = true): Promise<void> {
  await clearOrganizerSession();

  if (!redirect || typeof window === 'undefined') {
    return;
  }

  const path = window.location.pathname;
  if (path === ORGANIZER_LOGIN_PATH || path === ORGANIZER_VERIFY_PATH) {
    return;
  }

  window.location.assign(`${ORGANIZER_LOGIN_PATH}?sessao=expirada`);
}
