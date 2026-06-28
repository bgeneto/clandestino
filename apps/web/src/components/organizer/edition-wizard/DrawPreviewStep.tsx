import type { EditionWizardDraft } from '../../../db/clandestino-db.js';
import { isPlayerShuffleEnabled } from '../../../lib/feature-flags.js';

type DrawPreviewStepProps = {
  draft: EditionWizardDraft;
  onBack: () => void;
  onContinue: () => void;
  onRedraw?: () => void;
};

export function DrawPreviewStep({ draft, onBack, onContinue, onRedraw }: DrawPreviewStepProps) {
  const showShuffleButton = isPlayerShuffleEnabled() && onRedraw !== undefined;
  const preview = draft.drawPreview ?? [];

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Grupos formados</h3>
        <p className="mt-1 text-sm text-muted">
          Revise a distribuição dos jogadores antes de publicar o sorteio dos grupos.
        </p>
      </div>

      <div className="space-y-3">
        {preview.map((group) => (
          <section key={group.name} className="rounded-xl border border-line bg-card-muted p-4">
            <h4 className="text-sm font-bold text-foreground">{group.name}</h4>
            <ul className="mt-2 space-y-1 text-sm text-muted">
              {group.players.map((player) => (
                <li key={player.playerId} className="flex items-center justify-between">
                  <span>{player.playerName}</span>
                  {player.isSeed ? (
                    <span className="text-[10px] font-bold uppercase text-subtle">SEED</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {showShuffleButton ? (
        <button
          type="button"
          onClick={onRedraw}
          className="w-full rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-foreground"
        >
          🔄 Refazer sorteio dos jogadores
        </button>
      ) : null}

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
          disabled={preview.length === 0}
          onClick={onContinue}
          className="flex-1 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Continuar para publicação →
        </button>
      </div>
    </section>
  );
}
