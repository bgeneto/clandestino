import type { DrawSnapshot } from '@clandestino/shared-contracts';
import { formatDateTime } from '../../lib/format.js';

type DrawAuditPanelProps = {
  snapshots: DrawSnapshot[];
};

export function DrawAuditPanel({ snapshots }: DrawAuditPanelProps) {
  if (snapshots.length === 0) {
    return null;
  }

  const reference = snapshots[0]!;

  return (
    <details className="group rounded-xl bg-card-muted p-4 text-xs leading-6 text-muted">
      <summary className="flex cursor-pointer list-none items-center justify-between text-[13px] font-bold uppercase tracking-wide text-subtle [&::-webkit-details-marker]:hidden">
        Auditoria do sorteio
        <span aria-hidden className="text-[10px] transition-transform group-open:rotate-180">
          ▼
        </span>
      </summary>
      <div className="mt-2 border-t border-line pt-2">
        <p>Algoritmo: {reference.algorithm}</p>
        <p>Semente: {reference.randomSeed}</p>
        <p>Ranking: snapshot com {snapshots.length} jogadores</p>
        <p>Responsável: {reference.drawnBy}</p>
        <p>Realizado em: {formatDateTime(reference.drawnAt)}</p>
      </div>
    </details>
  );
}
