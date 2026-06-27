import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ApiError } from '../../lib/api-client.js';
import { verifyOrganizerMagicLink } from '../../lib/organizer-api.js';
import { useOrganizerSession } from '../../hooks/use-organizer-session.js';

export function OrganizerVerifyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  const { isLoggedIn, setSession } = useOrganizerSession();
  const [error, setError] = useState<string | null>(null);

  const verifyMutation = useMutation({
    mutationFn: () => verifyOrganizerMagicLink({ token }),
    onSuccess: async (response) => {
      await setSession({
        sessionToken: response.sessionToken,
        email: response.email,
        expiresAt: response.expiresAt,
      });
      void navigate('/organizador/painel', { replace: true });
    },
    onError: (mutationError) => {
      if (mutationError instanceof ApiError) {
        setError(mutationError.message);
        return;
      }

      setError('Não foi possível validar o link de acesso.');
    },
  });

  useEffect(() => {
    if (!token || isLoggedIn || verifyMutation.isPending || verifyMutation.isSuccess) {
      return;
    }

    void verifyMutation.mutate();
  }, [token, isLoggedIn, verifyMutation.isPending, verifyMutation.isSuccess]);

  if (isLoggedIn) {
    return <Navigate to="/organizador/painel" replace />;
  }

  if (!token) {
    return (
      <section className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-100">
        Link inválido.{' '}
        <Link className="underline" to="/organizador">
          Solicitar novo link
        </Link>
      </section>
    );
  }

  if (verifyMutation.isPending) {
    return <p className="text-sm text-slate-400">Validando link de acesso…</p>;
  }

  if (error) {
    return (
      <section className="space-y-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-100">
        <p>{error}</p>
        <Link
          className="inline-block rounded-lg bg-brand px-4 py-2 font-medium text-white"
          to="/organizador"
        >
          Solicitar novo link
        </Link>
      </section>
    );
  }

  return null;
}
