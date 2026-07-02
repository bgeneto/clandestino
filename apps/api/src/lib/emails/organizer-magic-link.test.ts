import { describe, expect, it } from 'vitest';
import { buildOrganizerMagicLinkEmail } from './organizer-magic-link.js';

describe('buildOrganizerMagicLinkEmail', () => {
  const verifyUrl = 'https://clandestino.test/organizador/entrar?token=abc123';

  it('monta assunto e corpo com URL e validade', () => {
    const content = buildOrganizerMagicLinkEmail({
      verifyUrl,
      expiresInMinutes: 15,
    });

    expect(content.subject).toBe('Seu link de acesso ao Clandestino');
    expect(content.html).toContain(verifyUrl);
    expect(content.html).toContain('15 minutos');
    expect(content.text).toContain(verifyUrl);
    expect(content.text).toContain('15 minutos');
    expect(content.text).toContain('apenas uma vez');
  });

  it('usa singular para validade de 1 minuto', () => {
    const content = buildOrganizerMagicLinkEmail({
      verifyUrl,
      expiresInMinutes: 1,
    });

    expect(content.html).toContain('1 minuto');
    expect(content.text).toContain('1 minuto');
    expect(content.html).not.toContain('1 minutos');
  });
});
