import { Navigate, Outlet } from 'react-router-dom';
import { useOrganizerSession } from '../../hooks/use-organizer-session.js';

export type OrganizerOutletContext = {
  organizerEmail: string;
};

export function OrganizerLayout() {
  const { session, isLoading } = useOrganizerSession();

  if (isLoading) {
    return null;
  }

  if (!session) {
    return <Navigate to="/organizador" replace />;
  }

  const context: OrganizerOutletContext = {
    organizerEmail: session.email,
  };

  return <Outlet context={context} />;
}
