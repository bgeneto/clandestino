import { useMemo, useState } from 'react';
import type { EditionParticipant } from '@clandestino/shared-contracts';
import { Alert } from '../ui/Alert.js';

type ParticipantListProps = {
  participants: EditionParticipant[];
  onSelect: (participant: EditionParticipant) => void;
};

export function ParticipantList({ participants, onSelect }: ParticipantListProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return participants;
    }

    return participants.filter((participant) =>
      participant.playerName.toLowerCase().includes(normalized),
    );
  }, [participants, query]);

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar seu nome..."
        className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-[15px] text-foreground outline-none ring-header focus:ring-2"
      />

      <div className="space-y-2">
        {filtered.map((participant) => (
          <button
            key={participant.playerId}
            type="button"
            onClick={() => onSelect(participant)}
            className="flex w-full items-center justify-between rounded-xl border border-line bg-card px-4 py-3.5 text-left transition active:bg-card-muted"
          >
            <div>
              <p className="text-base font-medium text-foreground">{participant.playerName}</p>
              <p className="text-xs text-subtle">
                Ranking: {participant.rankPosition}º — {participant.accumulatedPoints} pts
              </p>
            </div>
            {participant.isSeed ? (
              <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-950 dark:bg-amber-400">
                SEED
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        query.trim() ? (
          <p className="rounded-xl border border-warning-surface bg-warning-surface px-4 py-3 text-sm text-warning-foreground">
            Nenhum jogador encontrado com &quot;{query}&quot;. Fale com o organizador.
          </p>
        ) : null
      ) : (
        <Alert variant="info">Não encontrou seu nome? Fale com o organizador.</Alert>
      )}
    </div>
  );
}
