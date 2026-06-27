import { useMemo, useState } from 'react';
import type { EditionParticipant } from '@clandestino/shared-contracts';

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
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 outline-none ring-[#1a1a2e] focus:ring-2"
      />

      <div className="space-y-2">
        {filtered.map((participant) => (
          <button
            key={participant.playerId}
            type="button"
            onClick={() => onSelect(participant)}
            className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left transition active:bg-slate-50"
          >
            <div>
              <p className="text-base font-medium text-slate-900">{participant.playerName}</p>
              <p className="text-xs text-slate-500">
                Ranking: {participant.rankPosition}º — {participant.accumulatedPoints} pts
              </p>
            </div>
            {participant.isSeed ? (
              <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-bold text-slate-800">
                SEED
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Nenhum jogador encontrado com &quot;{query}&quot;. Fale com o organizador.
        </p>
      ) : (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Não encontrou seu nome? Fale com o organizador.
        </p>
      )}
    </div>
  );
}
