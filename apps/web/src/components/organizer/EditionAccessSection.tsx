import type { EditionStatus } from '@clandestino/shared-contracts';
import { EditionQrCode } from './EditionQrCode.js';
import { useEditionQr } from '../../hooks/use-organizer-data.js';
import { buildEditionEntryUrl } from '../../lib/edition-entry-url.js';

type EditionAccessSectionProps = {
  editionId?: string;
  editionName: string;
  editionStatus?: EditionStatus;
  offlinePending?: boolean;
};

function accessHint(status: EditionStatus | undefined): string {
  if (status === 'RASCUNHO' || status === 'INSCRICOES_ABERTAS') {
    return 'Compartilhe com antecedência — os jogadores poderão entrar assim que forem confirmados no check-in.';
  }

  if (status === 'ENCERRADA') {
    return 'Esta edição foi encerrada. O link permanece para consulta.';
  }

  return 'Exiba para os jogadores entrarem ou compartilhe no WhatsApp.';
}

export function EditionAccessSection({
  editionId,
  editionName,
  editionStatus,
  offlinePending = false,
}: EditionAccessSectionProps) {
  const qrQuery = useEditionQr(editionId, editionId !== undefined);

  if (offlinePending || !editionId) {
    return (
      <section className="rounded-xl border border-line bg-card p-4 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wide text-subtle">
          Acesso dos jogadores
        </h3>
        <p className="mt-2 text-sm text-muted">
          O link e o QR code ficarão disponíveis quando a edição for criada no servidor.
        </p>
      </section>
    );
  }

  if (editionStatus === 'ENCERRADA') {
    return null;
  }

  const entryUrl = qrQuery.data?.url ?? buildEditionEntryUrl(editionId);
  const isPreparing = editionStatus === 'RASCUNHO' || editionStatus === 'INSCRICOES_ABERTAS';

  return (
    <section
      className={[
        'rounded-xl border bg-card p-4 shadow-sm',
        isPreparing ? 'border-brand/40 ring-1 ring-brand/20' : 'border-line',
      ].join(' ')}
    >
      <h3 className="text-sm font-bold uppercase tracking-wide text-subtle">
        Acesso dos jogadores
      </h3>
      {isPreparing ? (
        <p className="mt-1 text-sm text-muted">
          Envie este link ou QR code aos jogadores <strong>antes do evento</strong> — não é preciso
          esperar o check-in ou o sorteio.
        </p>
      ) : null}
      <div className={isPreparing ? 'mt-4' : 'mt-3'}>
        <EditionQrCode url={entryUrl} hint={accessHint(editionStatus)} editionName={editionName} />
      </div>
    </section>
  );
}
