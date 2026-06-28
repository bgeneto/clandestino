import { useMemo } from 'react';
import type { EditionWizardDraft } from '../../../db/clandestino-db.js';
import { selectDefaultSeeds } from '@clandestino/tournament-engine';

type SeedsStepProps = {
  draft: EditionWizardDraft;
  onChange: (seedPlayerIds: string[]) => void;
  onContinue: () => void;
  onBack: () => void;
};

export function SeedsStep({ draft, onChange, onContinue, onBack }: SeedsStepProps) {
  const groupCount = draft.groupCount ?? 1;
  const selectedSeedIds = useMemo(
    () =>
      new Set(
        draft.seedPlayerIds ??
          selectDefaultSeeds(
            draft.checkedInPlayers.map((player) => ({
              playerId: player.playerId,
              playerName: player.playerName,
              accumulatedPoints: player.accumulatedPoints,
            })),
            groupCount,
          ),
      ),
    [draft.checkedInPlayers, draft.seedPlayerIds, groupCount],
  );

  const playersAlphabetical = useMemo(
    () =>
      [...draft.checkedInPlayers].sort((left, right) =>
        left.playerName.localeCompare(right.playerName, 'pt-BR'),
      ),
    [draft.checkedInPlayers],
  );

  const allZeroPoints = draft.checkedInPlayers.every((player) => player.accumulatedPoints === 0);
  const canContinue = selectedSeedIds.size === groupCount;

  function toggleSeed(playerId: string): void {
    const next = new Set(selectedSeedIds);
    if (next.has(playerId)) {
      next.delete(playerId);
    } else if (next.size < groupCount) {
      next.add(playerId);
    }

    onChange([...next]);
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Cabeças de Chave (Seeds)</h3>
        <p className="mt-1 text-sm text-muted">
          Escolha {groupCount} seed(s), um por grupo. Os melhores pontuados já vêm pré-selecionados.
        </p>
      </div>

      {allZeroPoints ? (
        <p className="rounded-lg border border-warning-surface bg-warning-surface px-3 py-2 text-sm text-warning-foreground">
          Nenhum jogador possui pontuação acumulada ainda. Confirme manualmente os seeds.
        </p>
      ) : null}

      <div className="space-y-2">
        {playersAlphabetical.map((player) => {
          const selected = selectedSeedIds.has(player.playerId);
          const disabled = !selected && selectedSeedIds.size >= groupCount;

          return (
            <button
              key={player.playerId}
              type="button"
              disabled={disabled}
              onClick={() => toggleSeed(player.playerId)}
              className={[
                'flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition',
                selected
                  ? 'border-amber-400 bg-amber-400/10 text-foreground'
                  : 'border-line bg-card-muted text-muted',
                disabled ? 'opacity-50' : 'hover:border-brand/50',
              ].join(' ')}
            >
              <span>{player.playerName}</span>
              <span className="text-xs text-subtle">
                {player.accumulatedPoints} pts
                {selected ? ' · SEED' : ''}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-sm text-subtle">
        Seeds selecionados: {selectedSeedIds.size} / {groupCount}
      </p>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-foreground"
        >
          ← Voltar
        </button>
        <button
          type="button"
          disabled={!canContinue}
          onClick={() => {
            onChange([...selectedSeedIds] as string[]);
            onContinue();
          }}
          className="flex-1 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Continuar →
        </button>
      </div>
    </section>
  );
}
