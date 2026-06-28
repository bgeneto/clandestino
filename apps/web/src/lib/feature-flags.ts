function parseEnvBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') {
    return defaultValue;
  }

  return value === 'true' || value === '1';
}

export function isPlayerShuffleEnabled(): boolean {
  return parseEnvBoolean(import.meta.env.VITE_SHOW_PLAYER_SHUFFLE, false);
}
