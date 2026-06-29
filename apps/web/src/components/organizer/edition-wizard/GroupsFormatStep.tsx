import { useMemo } from 'react';
import type { EditionWizardDraft } from '../../../db/clandestino-db.js';
import {
  WIZARD_WARN_GROUP_SIZE,
  buildGroupConfiguration,
  estimateRoundRobinMatches,
  maxGroupCount,
  partitionPlayersIntoGroups,
  suggestGroupCount,
} from '@clandestino/tournament-engine';

type GroupsFormatStepProps = {
  draft: EditionWizardDraft;
  onChange: (patch: Partial<EditionWizardDraft>) => void;
  onContinue: () => void;
  onBack: () => void;
};

function buildGroupName(index: number): string {
  return `Grupo ${String.fromCharCode(65 + index)}`;
}

export function GroupsFormatStep({ draft, onChange, onContinue, onBack }: GroupsFormatStepProps) {
  const playerCount = draft.checkedInPlayers.length;
  const maxGroups = maxGroupCount(playerCount);
  const groupCount = draft.groupCount ?? suggestGroupCount(playerCount);

  const groupSizes = useMemo(() => {
    try {
      return partitionPlayersIntoGroups(playerCount, groupCount);
    } catch {
      return [];
    }
  }, [groupCount, playerCount]);

  const totalMatches = estimateRoundRobinMatches(groupSizes);
  const largestGroup = groupSizes.length > 0 ? Math.max(...groupSizes) : 0;
  const largestGroupMatches = largestGroup > 0 ? estimateRoundRobinMatches([largestGroup]) : 0;

  const canContinue = groupSizes.length > 0;

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Grupos</h3>
        <p className="mt-1 text-sm text-muted">
          Com {playerCount} jogadores presentes, escolha quantos grupos formar.
        </p>
      </div>

      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          disabled={groupCount <= 1}
          onClick={() => {
            const config = buildGroupConfiguration(playerCount, groupCount - 1);
            onChange({ groupCount: config.groupCount, groupSizes: config.groupSizes });
          }}
          className="h-10 w-10 rounded-lg border border-line text-lg font-bold disabled:opacity-40"
        >
          −
        </button>
        <div className="text-center">
          <p className="text-3xl font-semibold text-foreground">{groupCount}</p>
          <p className="text-xs text-subtle">grupos</p>
        </div>
        <button
          type="button"
          disabled={groupCount >= maxGroups}
          onClick={() => {
            const config = buildGroupConfiguration(playerCount, groupCount + 1);
            onChange({ groupCount: config.groupCount, groupSizes: config.groupSizes });
          }}
          className="h-10 w-10 rounded-lg border border-line text-lg font-bold disabled:opacity-40"
        >
          +
        </button>
      </div>

      <div className="rounded-lg border border-line bg-card-muted p-3 text-sm">
        <p className="font-medium text-foreground">Distribuição sugerida</p>
        <ul className="mt-2 space-y-1 text-muted">
          {groupSizes.map((size, index) => (
            <li key={buildGroupName(index)}>
              {buildGroupName(index)}: {size} jogadores
            </li>
          ))}
        </ul>
        <p className="mt-3 font-semibold text-muted">
          Total de partidas na fase de grupos: {totalMatches}
        </p>
        <p className="mt-3 font-semibold text-muted">
          Tempo estimado para a fase de grupos: {Math.floor((largestGroupMatches * 20) / 60)}h
          {((largestGroupMatches * 20) % 60).toString().padStart(2, '0')}min
        </p>
        {largestGroup > WIZARD_WARN_GROUP_SIZE ? (
          <p className="mt-2 text-warning-foreground">
            Atenção: um grupo com {largestGroup} jogadores gera muitas partidas ({totalMatches}{' '}
            partidas).
          </p>
        ) : null}
      </div>

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
            onChange({ groupCount, groupSizes });
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
