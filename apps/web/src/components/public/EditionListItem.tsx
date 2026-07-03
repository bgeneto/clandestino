import { Link } from 'react-router-dom';
import type { EditionSummary } from '@clandestino/shared-contracts';
import { formatEditionDate, formatEditionStatus } from '../../lib/format.js';
import { isLiveEdition } from '../../lib/public-editions.js';

type EditionListItemProps = {
  edition: EditionSummary;
};

export function EditionListItem({ edition }: EditionListItemProps) {
  const live = isLiveEdition(edition.status);

  return (
    <li>
      <Link
        to={`/edicao/${edition.id}`}
        className={[
          'flex items-center justify-between gap-3 rounded-lg border px-4 py-3 transition hover:border-brand',
          live ? 'border-line bg-card-muted' : 'border-line/70 bg-card',
        ].join(' ')}
      >
        <span className="min-w-0">
          <span className="font-medium text-foreground">{edition.name}</span>
          <span className="ml-2 text-sm text-subtle">{formatEditionDate(edition.date)}</span>
        </span>
        <span className="shrink-0 text-sm text-subtle">{formatEditionStatus(edition.status)}</span>
      </Link>
    </li>
  );
}
