import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiConfig } from '../config.js';

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock };
    constructor() {}
  },
}));

import { createEmailSender, createNoopEmailSender, createResendEmailSender } from './email.js';

const baseConfig: ApiConfig = {
  host: '0.0.0.0',
  port: 3000,
  databaseUrl: 'file:./data/clandestino.db',
  organizerAllowedEmails: ['organizador@gmail.com'],
  organizerMagicLinkTtlMinutes: 15,
  organizerSessionTtlHours: 720,
  publicAppUrl: 'http://localhost:5173',
  exposeMagicLinks: true,
  isProduction: false,
  email: null,
  sendOrganizerMagicLinkEmail: false,
  csvImportMaxBytes: 1_048_576,
  authRateLimitMax: 10,
  authRateLimitWindowMinutes: 15,
};

describe('createNoopEmailSender', () => {
  it('resolve sem efeitos colaterais', async () => {
    const sender = createNoopEmailSender();
    await expect(
      sender.sendOrganizerMagicLink({
        to: 'organizador@gmail.com',
        verifyUrl: 'https://example.com/entrar?token=abc',
        expiresInMinutes: 15,
      }),
    ).resolves.toBeUndefined();
  });
});

describe('createEmailSender', () => {
  it('retorna noop quando envio por e-mail está desativado', async () => {
    const sender = createEmailSender({
      ...baseConfig,
      email: {
        apiKey: 're_test',
        fromEmail: 'admin@sistema.pro.br',
        fromName: 'Clandestino',
      },
      sendOrganizerMagicLinkEmail: false,
    });

    await expect(
      sender.sendOrganizerMagicLink({
        to: 'organizador@gmail.com',
        verifyUrl: 'https://example.com/entrar?token=abc',
        expiresInMinutes: 15,
      }),
    ).resolves.toBeUndefined();

    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe('createResendEmailSender', () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it('envia e-mail com from, html e text', async () => {
    sendMock.mockResolvedValue({ data: { id: 'email_123' }, error: null });

    const sender = createResendEmailSender({
      apiKey: 're_test',
      fromEmail: 'admin@sistema.pro.br',
      fromName: 'Clandestino - Tênis de Mesa',
    });

    await sender.sendOrganizerMagicLink({
      to: 'organizador@gmail.com',
      verifyUrl: 'https://clandestino.test/organizador/entrar?token=abc',
      expiresInMinutes: 15,
    });

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Clandestino - Tênis de Mesa <admin@sistema.pro.br>',
        to: ['organizador@gmail.com'],
        subject: 'Seu link de acesso ao Clandestino',
        html: expect.stringContaining('https://clandestino.test/organizador/entrar?token=abc'),
        text: expect.stringContaining('https://clandestino.test/organizador/entrar?token=abc'),
      }),
    );
  });

  it('propaga erro do Resend', async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: 'API key inválida' } });

    const sender = createResendEmailSender({
      apiKey: 're_invalid',
      fromEmail: 'admin@sistema.pro.br',
      fromName: 'Clandestino',
    });

    await expect(
      sender.sendOrganizerMagicLink({
        to: 'organizador@gmail.com',
        verifyUrl: 'https://example.com/entrar?token=abc',
        expiresInMinutes: 15,
      }),
    ).rejects.toThrow('API key inválida');
  });
});
