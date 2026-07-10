import type { EditionStatus } from '@clandestino/shared-contracts';
import { EditionQrCode } from './EditionQrCode.js';
import { useEditionQr } from '../../hooks/use-organizer-data.js';
import { buildEditionEntryUrl } from '../../lib/edition-entry-url.js';

type EditionAccessSectionProps = {
  editionId: string;
  editionName: string;
  editionStatus: EditionStatus;
};

export function canShareEditionAccess(status: EditionStatus): boolean {
  return status === 'EM_ANDAMENTO' || status === 'FASE_COLOCACAO';
}

export function EditionAccessSection({
  editionId,
  editionName,
  editionStatus,
}: EditionAccessSectionProps) {
  const canShare = canShareEditionAccess(editionStatus);
  const qrQuery = useEditionQr(editionId, canShare);

  if (!canShare) {
    return null;
  }

  const entryUrl = qrQuery.data?.url ?? buildEditionEntryUrl(editionId);

  return (
    <section className="rounded-xl bg-card p-4 shadow-sm">
      <h3 className="text-sm font-bold uppercase tracking-wide text-subtle">
        Acesso dos jogadores
      </h3>
      <p className="mt-1 text-sm text-muted">
        Grupos e partidas publicados. Exiba o QR code ou envie o link pelo WhatsApp.
      </p>
      <div className="mt-4">
        <EditionQrCode
          url={entryUrl}
          hint="Ao entrar, cada jogador verá seu grupo e suas partidas."
          editionName={editionName}
        />
      </div>
    </section>
  );
}
