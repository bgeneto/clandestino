import { useEffect } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '../../lib/api-client.js';
import { fetchOrganizerSession } from '../../lib/organizer-api.js';
import { useOrganizerSession } from '../../hooks/use-organizer-session.js';

export type OrganizerOutletContext = {
  organizerEmail: string;
};

export function OrganizerLayout() {
  const navigate = useNavigate();
  const { session, isLoading, clearSession } = useOrganizerSession();

  const sessionCheck = useQuery({
    queryKey: ['organizer', 'session-check'],
    queryFn: fetchOrganizerSession,
    enabled: !isLoading && session !== undefined,
    retry: false,
    staleTime: 60_000,
  });

  const sessionInvalid =
    sessionCheck.isError &&
    sessionCheck.error instanceof ApiError &&
    sessionCheck.error.status === 401;

  useEffect(() => {
    if (!sessionInvalid) {
      return;
    }

    void clearSession().then(() => {
      void navigate('/organizador?sessao=expirada', { replace: true });
    });
  }, [sessionInvalid, clearSession, navigate]);

  if (isLoading || (session && sessionCheck.isPending)) {
    return null;
  }

  if (sessionInvalid) {
    return null;
  }

  if (!session) {
    return <Navigate to="/organizador" replace />;
  }

  const context: OrganizerOutletContext = {
    organizerEmail: session.email,
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Outlet context={context} />
      <footer className="mt-auto py-4 group/footer">
        <button
          type="button"
          onClick={() => void clearSession()}
          className="w-full rounded-lg border border-line px-4 py-2 text-sm text-muted transition-colors group-hover/footer:bg-card-muted hover:dark:bg-[#1e293b]"
        >
          Sair
        </button>
      </footer>
    </div>
  );
}
