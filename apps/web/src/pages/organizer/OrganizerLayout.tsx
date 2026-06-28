import { Navigate, Outlet } from 'react-router-dom';
import { useOrganizerSession } from '../../hooks/use-organizer-session.js';

export type OrganizerOutletContext = {
  organizerEmail: string;
};

export function OrganizerLayout() {
  const { session, isLoading, clearSession } = useOrganizerSession();

  if (isLoading) {
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
      <footer className="mt-auto py-4">
        <button
          type="button"
          onClick={() => void clearSession()}
          className="w-full rounded-lg border border-line px-4 py-2 text-sm text-muted"
        >
          Sair
        </button>
      </footer>
    </div>
  );
}
