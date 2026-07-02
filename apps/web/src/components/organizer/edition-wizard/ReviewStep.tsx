import { Link } from 'react-router-dom';
import type { EditionWizardDraft } from '../../../db/clandestino-db.js';
import { estimateRoundRobinMatches } from '@clandestino/tournament-engine';
import { formatEditionDate } from '../../../lib/format.js';
import { Alert } from '../../../components/ui/Alert.js';

type ReviewStepProps = {
  draft: EditionWizardDraft;
  isOnline: boolean;
  isPublishing: boolean;
  onBack: () => void;
  onPublish: () => void;
};

export function ReviewStep({ draft, isOnline, isPublishing, onBack, onPublish }: ReviewStepProps) {
  const totalMatches = estimateRoundRobinMatches(draft.groupSizes ?? []);
  const groupSizes = draft.groupSizes ?? [];
  const largestGroup = groupSizes.length > 0 ? Math.max(...groupSizes) : 0;
  const largestGroupMatches = largestGroup > 0 ? estimateRoundRobinMatches([largestGroup]) : 0;

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
          <dt className="text-subtle">Partidas da fase de grupos</dt>
          <dd className="text-foreground">{totalMatches}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-subtle">Tempo estimado das partidas</dt>
          <dd className="text-foreground">
            {Math.floor((largestGroupMatches * 20) / 60)}h
            {((largestGroupMatches * 20) % 60).toString().padStart(2, '0')}min
          </dd>
        </div>
      </dl>

      {!isOnline ? (
        <Alert variant="warning">
          Sem conexão: o sorteio ficará pronto para sincronizar quando a internet voltar.
        </Alert>
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
          className="flex-1 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {isPublishing ? 'Publicando…' : isOnline ? 'Publicar sorteio' : 'Salvar para sincronizar'}
        </button>
      </div>

      {isOnline ? (
        <p className="text-center text-xs text-subtle">
          Após publicar, você será levado à página da edição.
        </p>
      ) : null}
    </section>
  );
}
