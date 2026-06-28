import { useMemo, useState } from 'react';
import { validatePlayerName } from '@clandestino/shared-contracts';
import type { EditionWizardDraft, WizardDraftPlayer } from '../../../db/clandestino-db.js';
import { WIZARD_MIN_GROUP_SIZE } from '@clandestino/tournament-engine';

type CheckInStepProps = {
  draft: EditionWizardDraft;
  availablePlayers: WizardDraftPlayer[];
  onTogglePlayer: (player: WizardDraftPlayer) => void;
  onAddNewPlayer: (name: string) => void;
  onContinue: () => void;
};

export function CheckInStep({
  draft,
  availablePlayers,
  onTogglePlayer,
  onAddNewPlayer,
  onContinue,
}: CheckInStepProps) {
  const [search, setSearch] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  const checkedInIds = useMemo(
    () => new Set(draft.checkedInPlayers.map((player) => player.playerId)),
    [draft.checkedInPlayers],
  );

  const filteredPlayers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    const players = [
      ...availablePlayers,
      ...draft.checkedInPlayers.filter((player) => player.isNew),
    ]
      .filter(
        (player, index, array) =>
          array.findIndex((entry) => entry.playerId === player.playerId) === index,
      )
      .sort((left, right) => left.playerName.localeCompare(right.playerName, 'pt-BR'));

    if (!normalized) {
      return players;
    }

    return players.filter((player) => player.playerName.toLowerCase().includes(normalized));
  }, [availablePlayers, draft.checkedInPlayers, search]);

  const canContinue = draft.checkedInPlayers.length >= WIZARD_MIN_GROUP_SIZE;

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Check-in dos participantes</h3>
        <p className="mt-1 text-sm text-muted">
          Selecione apenas os jogadores presentes nesta edição.
        </p>
      </div>

      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Buscar jogador…"
        className="w-full rounded-lg border border-line bg-card-muted px-3 py-2.5 text-sm text-foreground"
      />

      <div className="space-y-2">
        {filteredPlayers.map((player) => {
          const checkedIn = checkedInIds.has(player.playerId);
          return (
            <button
              key={player.playerId}
              type="button"
              onClick={() => onTogglePlayer(player)}
              className={[
                'flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition',
                checkedIn
                  ? 'border-brand bg-brand/10 text-foreground'
                  : 'border-line bg-card-muted text-muted hover:border-brand/50',
              ].join(' ')}
            >
              <span>{player.playerName}</span>
              <span className="text-xs text-subtle">
                {player.accumulatedPoints} pts · {checkedIn ? 'Presente' : 'Marcar'}
              </span>
            </button>
          );
        })}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const validation = validatePlayerName(newPlayerName);
          if (!validation.ok) {
            setNameError(validation.error);
            return;
          }

          onAddNewPlayer(validation.name);
          setNewPlayerName('');
          setNameError(null);
        }}
      >
        <input
          value={newPlayerName}
          onChange={(event) => {
            setNewPlayerName(event.target.value);
            if (nameError) {
              setNameError(null);
            }
          }}
          placeholder="Novo jogador (primeira participação)"
          className="flex-1 rounded-lg border border-line bg-card-muted px-3 py-2.5 text-sm text-foreground"
        />
        <button
          type="submit"
          className="rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-foreground"
        >
          Adicionar
        </button>
      </form>

      {nameError ? <p className="text-sm text-danger-foreground">{nameError}</p> : null}

      <p className="text-sm text-subtle">
        Presentes: {draft.checkedInPlayers.length} (mínimo {WIZARD_MIN_GROUP_SIZE})
      </p>

      <button
        type="button"
        disabled={!canContinue}
        onClick={onContinue}
        className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white disabled:opacity-50"
      >
        Continuar para grupos
      </button>
    </section>
  );
}
