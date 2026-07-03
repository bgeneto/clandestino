import type { EditionStatus } from '@clandestino/shared-contracts';
import { EditionQrCode } from './EditionQrCode.js';
import { useEditionQr } from '../../hooks/use-organizer-data.js';

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

  return (
    <section className="rounded-xl border border-line bg-card p-4 shadow-sm">
      <h3 className="mb-3 text-center text-sm font-bold uppercase text-subtle">
        Acesso dos jogadores
      </h3>
      {qrQuery.isLoading ? (
        <p className="text-center text-sm text-subtle">Carregando link…</p>
      ) : qrQuery.isError || !qrQuery.data ? (
        <p className="text-center text-sm text-subtle">
          Não foi possível carregar o link da edição.
        </p>
      ) : (
        <EditionQrCode
          url={qrQuery.data.url}
          hint={accessHint(editionStatus)}
          editionName={editionName}
        />
      )}
    </section>
  );
}
