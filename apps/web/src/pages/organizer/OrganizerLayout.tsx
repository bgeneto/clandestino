import { Navigate, Outlet } from 'react-router-dom';
import { useOrganizerSession } from '../../hooks/use-organizer-session.js';

export type OrganizerOutletContext = {
  organizerEmail: string;
};

export function OrganizerLayout() {
  const { session, isLoggedIn } = useOrganizerSession();

  if (!isLoggedIn || !session) {
    return <Navigate to="/organizador" replace />;
  }

  const context: OrganizerOutletContext = {
    organizerEmail: session.email,
  };

  return <Outlet context={context} />;
}
