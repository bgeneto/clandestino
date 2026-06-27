import type { ReactNode } from 'react';
import type { Edition } from '@clandestino/shared-contracts';
import { formatEditionDate, formatEditionStatus } from '../../lib/format.js';

type EditionHeaderProps = {
  edition: Edition;
  subtitle?: string;
  badge?: ReactNode;
  live?: boolean;
};

export function EditionHeader({ edition, subtitle, badge, live = false }: EditionHeaderProps) {
  return (
    <header className="rounded-2xl bg-[#1a1a2e] px-4 py-4 text-white shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">
            🏓 {edition.name}
            {live ? (
              <span className="ml-2 inline-flex rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                Ao vivo
              </span>
            ) : null}
          </h1>
          <p className="mt-1 text-xs text-white/70">
            {formatEditionDate(edition.date)} · {formatEditionStatus(edition.status)}
          </p>
          {subtitle ? <p className="mt-2 text-sm text-white/80">{subtitle}</p> : null}
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
    </header>
  );
}
