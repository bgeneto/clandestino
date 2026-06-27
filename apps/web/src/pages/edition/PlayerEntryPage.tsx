import { useState } from 'react';
import { Link, Navigate, useNavigate, useOutletContext } from 'react-router-dom';
import { EditionHeader } from '../../components/edition/EditionHeader.js';
import { ParticipantList } from '../../components/edition/ParticipantList.js';
import { useEditionParticipants } from '../../hooks/use-edition-data.js';
import { usePlayerSession } from '../../hooks/use-player-session.js';
import type { EditionParticipant } from '@clandestino/shared-contracts';
import type { EditionOutletContext } from './EditionLayout.js';

export function PlayerEntryPage() {
  const { edition, editionId } = useOutletContext<EditionOutletContext>();
  const navigate = useNavigate();
  const { session, setSession, isLoggedIn } = usePlayerSession();
  const participantsQuery = useEditionParticipants(editionId);
  const [pendingParticipant, setPendingParticipant] = useState<EditionParticipant | null>(null);
  const [saving, setSaving] = useState(false);

  if (isLoggedIn && session?.editionId === editionId) {
    return <Navigate to={`/edicao/${editionId}/partidas`} replace />;
  }

  const handleConfirm = async () => {
    if (!pendingParticipant) {
      return;
    }

    setSaving(true);
    try {
      await setSession({
        playerId: pendingParticipant.playerId,
        editionId,
        playerName: pendingParticipant.playerName,
      });
      navigate(`/edicao/${editionId}/partidas`, { replace: true });
    } finally {
      setSaving(false);
    }
  };

  if (pendingParticipant) {
    return (
      <div className="space-y-4">
        <EditionHeader edition={edition} subtitle="Confirme sua identidade" />
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Confirme que este é o seu nome</p>
          <p className="mt-2 text-2xl font-bold text-[#1a1a2e]">{pendingParticipant.playerName}</p>
          <p className="mt-2 text-amber-900/80">
            Você está entrando na edição <strong>{edition.name}</strong>. Essa escolha fica salva
            neste dispositivo.
          </p>
        </section>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPendingParticipant(null)}
            className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
          >
            Voltar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleConfirm()}
            className="flex-1 rounded-xl bg-[#1a1a2e] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            Confirmar e entrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <EditionHeader edition={edition} subtitle="Selecione seu nome para entrar" />

      {participantsQuery.isLoading ? (
        <p className="text-sm text-slate-400">Carregando participantes…</p>
      ) : participantsQuery.isError ? (
        <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p>Seu nome não está na lista. Fale com o organizador.</p>
          <Link to={`/edicao/${editionId}`} className="font-semibold text-[#1a1a2e] underline">
            Ver torneio em modo público
          </Link>
        </section>
      ) : (
        <>
          <ParticipantList
            participants={participantsQuery.data ?? []}
            onSelect={setPendingParticipant}
          />
          <Link
            to={`/edicao/${editionId}`}
            className="block text-center text-sm text-slate-500 underline"
          >
            Ver torneio sem entrar
          </Link>
        </>
      )}
    </div>
  );
}
