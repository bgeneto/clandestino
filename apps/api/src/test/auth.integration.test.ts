import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { hashToken } from '../lib/crypto.js';
import {
  adminQuery,
  closeTestDb,
  createTestApp,
  hasTestDb,
  loginOrganizer,
  migrateTestDb,
  truncateAll,
} from './integration-setup.js';

const ALLOWED_EMAIL = 'organizador@gmail.com';

describe.skipIf(!hasTestDb)('autenticação do organizador (integração HTTP)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    await migrateTestDb();
    app = await createTestApp();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await app.close();
    await closeTestDb();
  });

  it('expõe o magic link fora de produção e o token é de uso único', async () => {
    const requested = await app.inject({
      method: 'POST',
      url: '/auth/organizer/magic-link',
      payload: { email: ALLOWED_EMAIL },
    });
    expect(requested.statusCode).toBe(200);
    const magicLink = requested.json<{ magicLink?: string }>().magicLink;
    expect(magicLink).toBeTruthy();

    const token = new URL(magicLink!).searchParams.get('token')!;

    const firstVerify = await app.inject({
      method: 'POST',
      url: '/auth/organizer/verify',
      payload: { token },
    });
    expect(firstVerify.statusCode).toBe(200);
    expect(firstVerify.json<{ sessionToken: string }>().sessionToken).toBeTruthy();

    const secondVerify = await app.inject({
      method: 'POST',
      url: '/auth/organizer/verify',
      payload: { token },
    });
    expect(secondVerify.statusCode).toBe(401);
  });

  it('rejeita e-mail não autorizado sem emitir magic link', async () => {
    const requested = await app.inject({
      method: 'POST',
      url: '/auth/organizer/magic-link',
      payload: { email: 'intruso@example.com' },
    });
    expect(requested.statusCode).toBe(403);
    expect(requested.json<{ magicLink?: string }>().magicLink).toBeUndefined();
  });

  it('rejeita token expirado', async () => {
    const rawToken = 'token-de-teste-expirado-1234567890';
    // Inserção direta de token já expirado para validar o caminho de expiração.
    await adminQuery(
      `INSERT INTO organizer_magic_token (id, email, token_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), ALLOWED_EMAIL, hashToken(rawToken), Date.now() - 60_000, Date.now()],
    );

    const verify = await app.inject({
      method: 'POST',
      url: '/auth/organizer/verify',
      payload: { token: rawToken },
    });
    expect(verify.statusCode).toBe(401);
  });

  it('loginOrganizer helper produz um sessionToken utilizável', async () => {
    const sessionToken = await loginOrganizer(app);
    const created = await app.inject({
      method: 'POST',
      url: '/players',
      headers: { authorization: `Bearer ${sessionToken}` },
      payload: { name: 'Jogador Autenticado' },
    });
    expect(created.statusCode).toBe(201);
  });

  it('GET /auth/organizer/session valida sessão ativa e rejeita token inválido', async () => {
    const sessionToken = await loginOrganizer(app);

    const valid = await app.inject({
      method: 'GET',
      url: '/auth/organizer/session',
      headers: { authorization: `Bearer ${sessionToken}` },
    });
    expect(valid.statusCode).toBe(200);
    expect(valid.json<{ email: string; expiresAt: string }>().email).toBe(ALLOWED_EMAIL);

    const invalid = await app.inject({
      method: 'GET',
      url: '/auth/organizer/session',
      headers: { authorization: 'Bearer token-invalido' },
    });
    expect(invalid.statusCode).toBe(401);
  });

  it('NÃO expõe magic link quando NODE_ENV=production', async () => {
    const prodApp = await createTestApp({ NODE_ENV: 'production' });
    try {
      const requested = await prodApp.inject({
        method: 'POST',
        url: '/auth/organizer/magic-link',
        payload: { email: ALLOWED_EMAIL },
      });
      expect(requested.statusCode).toBe(200);
      expect(requested.json<{ magicLink?: string }>().magicLink).toBeUndefined();
    } finally {
      await prodApp.close();
    }
  });

  it('aplica rate limit nas rotas de magic link', async () => {
    const limitedApp = await createTestApp({ AUTH_RATE_LIMIT_MAX: '3' });
    try {
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 4; attempt++) {
        const response = await limitedApp.inject({
          method: 'POST',
          url: '/auth/organizer/magic-link',
          payload: { email: ALLOWED_EMAIL },
        });
        statuses.push(response.statusCode);
      }
      expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
      expect(statuses[3]).toBe(429);
    } finally {
      await limitedApp.close();
    }
  });
});
