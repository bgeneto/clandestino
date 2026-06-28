import { NavLink } from 'react-router-dom';

type PlayerNavProps = {
  editionId: string;
};

const navClassName = ({ isActive }: { isActive: boolean }) =>
  [
    'flex flex-1 flex-col items-center gap-1 py-2 text-[11px] transition',
    isActive ? 'font-bold text-foreground' : 'text-subtle',
  ].join(' ');

export function PlayerNav({ editionId }: PlayerNavProps) {
  const base = `/edicao/${editionId}`;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card">
      <div className="mx-auto flex max-w-3xl">
        <NavLink to={`${base}/partidas`} className={navClassName}>
          <span aria-hidden="true">🎾</span>
          <span>Partidas</span>
        </NavLink>
        <NavLink to={`${base}/grupo`} className={navClassName}>
          <span aria-hidden="true">👥</span>
          <span>Meu Grupo</span>
        </NavLink>
        <NavLink to={`${base}/classificacao`} className={navClassName}>
          <span aria-hidden="true">🏆</span>
          <span>Classificação</span>
        </NavLink>
      </div>
    </nav>
  );
}
