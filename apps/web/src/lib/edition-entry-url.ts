/** URL pública para o jogador entrar na edição (mesma origem do PWA). */
export function buildEditionEntryUrl(editionId: string): string {
  return `${window.location.origin}/edicao/${editionId}/entrar`;
}
