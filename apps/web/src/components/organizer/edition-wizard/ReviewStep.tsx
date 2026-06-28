import { Link } from 'react-router-dom';
import type { EditionWizardDraft } from '../../../db/clandestino-db.js';
import { estimateRoundRobinMatches } from '@clandestino/tournament-engine';
import { formatEditionDate } from '../../../lib/format.js';

type ReviewStepProps = {
  draft: EditionWizardDraft;
  isOnline: boolean;
  isPublishing: boolean;
  feedback: string | null;
  onBack: () => void;
  onPublish: () => void;
};

export function ReviewStep({
  draft,
  isOnline,
  isPublishing,
  feedback,
  onBack,
  onPublish,
}: ReviewStepProps) {
  const totalMatches = estimateRoundRobinMatches(draft.groupSizes ?? []);

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Revisão e publicação</h3>
        <p className="mt-1 text-sm text-muted">
          Confira os dados antes de {isOnline ? 'publicar no servidor' : 'guardar para sincronizar'}
          .
        </p>
      </div>

      <dl className="space-y-2 rounded-lg border border-line bg-card-muted p-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-subtle">Nome</dt>
          <dd className="text-foreground">{draft.predictedEditionName}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-subtle">Data</dt>
          <dd className="text-foreground">{formatEditionDate(draft.date)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-subtle">Auto-confirmação</dt>
          <dd className="text-foreground">{draft.autoConfirmMinutes} min</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-subtle">Presentes</dt>
          <dd className="text-foreground">{draft.checkedInPlayers.length}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-subtle">Grupos</dt>
          <dd className="text-foreground">{draft.groupCount}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-subtle">Formato</dt>
          <dd className="text-foreground">Melhor de {draft.matchBestOf}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-subtle">Partidas estimadas</dt>
          <dd className="text-foreground">{totalMatches}</dd>
        </div>
      </dl>

      {!isOnline ? (
        <p className="rounded-lg border border-warning-surface bg-warning-surface px-3 py-2 text-sm text-warning-foreground">
          Sem conexão: o sorteio ficará pronto para sincronizar quando a internet voltar.
        </p>
      ) : null}

      {feedback ? (
        <p className="rounded-lg border border-line bg-card-muted px-3 py-2 text-sm text-muted">
          {feedback}
        </p>
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
          disabled={isPublishing}
          onClick={onPublish}
          className="flex-1 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {isPublishing
            ? 'Publicando…'
            : isOnline
              ? 'Publicar sorteio e gerar partidas'
              : 'Salvar para sincronizar'}
        </button>
      </div>

      {draft.editionId ? (
        <Link
          to={`/organizador/edicao/${draft.editionId}`}
          className="block text-center text-sm text-subtle underline"
        >
          Ir para painel da edição
        </Link>
      ) : null}
    </section>
  );
}
