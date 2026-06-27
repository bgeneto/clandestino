import { Navigate, Outlet, useOutletContext, useParams } from 'react-router-dom';
import { PlayerNav } from '../../components/edition/PlayerNav.js';
import { usePlayerSession } from '../../hooks/use-player-session.js';
import type { EditionOutletContext } from './EditionLayout.js';

export function RequirePlayerSession() {
  const { editionId } = useParams<{ editionId: string }>();
  const { session, isLoggedIn } = usePlayerSession();
  const context = useOutletContext<EditionOutletContext>();

  if (!isLoggedIn || !session || session.editionId !== editionId) {
    return <Navigate to={`/edicao/${editionId}/entrar`} replace />;
  }

  return (
    <div className="pb-20">
      <Outlet context={{ ...context, session }} />
      <PlayerNav editionId={editionId!} />
    </div>
  );
}

export type PlayerOutletContext = EditionOutletContext & {
  session: NonNullable<ReturnType<typeof usePlayerSession>['session']>;
};
