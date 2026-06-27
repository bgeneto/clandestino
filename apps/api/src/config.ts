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
  isProduction: boolean;
  csvImportMaxBytes: number;
  authRateLimitMax: number;
  authRateLimitWindowMinutes: number;
};

/** Avisos de configuração potencialmente inseguros, emitidos no bootstrap. */
export const configWarnings: string[] = [];

function parseAllowedEmails(raw: string | undefined): string[] {
  if (!raw) {
    return ['organizador@fitpong.local'];
  }

  return raw
    .split(',')
    .map((email) => email.trim())
    .filter((email) => email.length > 0);
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL é obrigatória para iniciar a API.');
  }

  const isProduction = env.NODE_ENV === 'production';
  const exposeOptIn = env.EXPOSE_MAGIC_LINKS === 'true';

  // Segurança: em produção, NUNCA expor magic links na resposta HTTP,
  // mesmo que EXPOSE_MAGIC_LINKS=true tenha sido definido por engano.
  // Fora de produção, o padrão é expor (facilita testes sem e-mail).
  const exposeMagicLinks = isProduction
    ? false
    : exposeOptIn || env.EXPOSE_MAGIC_LINKS === undefined;

  if (isProduction && exposeOptIn) {
    configWarnings.push(
      'EXPOSE_MAGIC_LINKS=true foi ignorado porque NODE_ENV=production. ' +
        'Magic links nunca são expostos na resposta em produção.',
    );
  }

  return {
    host: env.API_HOST ?? '0.0.0.0',
    port: parsePositiveInt(env.API_PORT, 3000),
    databaseUrl,
    organizerAllowedEmails: parseAllowedEmails(env.ORGANIZER_ALLOWED_EMAILS),
    organizerMagicLinkTtlMinutes: parsePositiveInt(env.ORGANIZER_MAGIC_LINK_TTL_MINUTES, 15),
    organizerSessionTtlHours: parsePositiveInt(env.ORGANIZER_SESSION_TTL_HOURS, 168),
    publicAppUrl: env.PUBLIC_APP_URL ?? 'http://localhost:5173',
    exposeMagicLinks,
    isProduction,
    // Limite de tamanho do corpo aceito na importação CSV (padrão 1 MiB).
    csvImportMaxBytes: parsePositiveInt(env.CSV_IMPORT_MAX_BYTES, 1_048_576),
    // Limite de requisições nas rotas de magic link (anti-abuso / anti-spam).
    authRateLimitMax: parsePositiveInt(env.AUTH_RATE_LIMIT_MAX, 10),
    authRateLimitWindowMinutes: parsePositiveInt(env.AUTH_RATE_LIMIT_WINDOW_MINUTES, 15),
  };
}
