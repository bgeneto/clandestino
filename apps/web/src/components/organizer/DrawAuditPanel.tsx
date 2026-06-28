import type { DrawSnapshot } from '@clandestino/shared-contracts';

type DrawAuditPanelProps = {
  snapshots: DrawSnapshot[];
};

export function DrawAuditPanel({ snapshots }: DrawAuditPanelProps) {
  if (snapshots.length === 0) {
    return null;
  }

  const reference = snapshots[0]!;

  return (
    <section className="rounded-xl bg-card-muted p-4 text-xs leading-6 text-muted">
      <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-subtle">
        Auditoria do sorteio
      </h3>
      <p>Algoritmo: {reference.algorithm}</p>
      <p>Semente: {reference.randomSeed}</p>
      <p>Ranking: snapshot com {snapshots.length} jogadores</p>
      <p>Responsável: {reference.drawnBy}</p>
      <p>Realizado em: {new Date(reference.drawnAt).toLocaleString('pt-BR')}</p>
    </section>
  );
}
