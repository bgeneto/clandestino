import 'dotenv/config';

export type ApiConfig = {
  host: string;
  port: number;
  databaseUrl: string;
  organizerAllowedEmails: string[];
  organizerMagicLinkTtlMinutes: number;
  organizerSessionTtlHours: number;
  publicAppUrl: string;
  exposeMagicLinks: boolean;
};

function parseAllowedEmails(raw: string | undefined): string[] {
  if (!raw) {
    return ['organizador@fitpong.local'];
  }

  return raw
    .split(',')
    .map((email) => email.trim())
    .filter((email) => email.length > 0);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL é obrigatória para iniciar a API.');
  }

  return {
    host: env.API_HOST ?? '0.0.0.0',
    port: Number.parseInt(env.API_PORT ?? '3000', 10),
    databaseUrl,
    organizerAllowedEmails: parseAllowedEmails(env.ORGANIZER_ALLOWED_EMAILS),
    organizerMagicLinkTtlMinutes: Number.parseInt(env.ORGANIZER_MAGIC_LINK_TTL_MINUTES ?? '15', 10),
    organizerSessionTtlHours: Number.parseInt(env.ORGANIZER_SESSION_TTL_HOURS ?? '168', 10),
    publicAppUrl: env.PUBLIC_APP_URL ?? 'http://localhost:5173',
    exposeMagicLinks: env.EXPOSE_MAGIC_LINKS === 'true' || env.NODE_ENV !== 'production',
  };
}
