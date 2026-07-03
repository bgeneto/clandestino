import type { Championship } from '@clandestino/shared-contracts';
import { Link } from 'react-router-dom';

type PublicChampionshipCardProps = {
  championship: Championship;
};

export function PublicChampionshipCard({ championship }: PublicChampionshipCardProps) {
  return (
    <Link
      to={`/campeonato/${championship.id}`}
      className="block rounded-2xl border border-line bg-card px-5 py-4 text-foreground transition hover:border-brand"
    >
      <p className="font-medium">{championship.name}</p>
      <p className="mt-1 text-sm text-subtle">Ranking, edições e placares deste campeonato</p>
    </Link>
  );
}
