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
        <section className="rounded-xl border border-warning-surface bg-warning-surface p-4 text-sm text-warning-foreground">
          <p className="font-semibold">Confirme que este é o seu nome</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{pendingParticipant.playerName}</p>
          <p className="mt-2 text-warning-foreground/80">
            Você está entrando na edição <strong>{edition.name}</strong>.<br />
            (essa escolha fica salva neste dispositivo)
          </p>
        </section>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPendingParticipant(null)}
            className="flex-1 rounded-xl border border-line bg-card px-4 py-3 text-sm font-semibold text-muted"
          >
            ← Voltar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleConfirm()}
            className="flex-1 rounded-xl bg-header px-4 py-3 text-sm font-semibold text-header-foreground disabled:opacity-60"
          >
            Confirmar e entrar →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <EditionHeader edition={edition} subtitle="Selecione seu nome para entrar" />

      {participantsQuery.isLoading ? (
        <p className="text-sm text-subtle">Carregando participantes…</p>
      ) : participantsQuery.isError ? (
        <section className="space-y-3 rounded-xl border border-warning-surface bg-warning-surface p-4 text-sm text-warning-foreground">
          <p>Seu nome não está na lista. Fale com o organizador.</p>
          <Link to={`/edicao/${editionId}`} className="font-semibold text-foreground underline">
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
            className="block text-center text-sm text-subtle underline"
          >
            Ver torneio sem entrar
          </Link>
        </>
      )}
    </div>
  );
}
