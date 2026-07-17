import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import type { OrganizerSessionResponse } from '@clandestino/shared-contracts';
import { ApiError } from '../../lib/api-client.js';
import { verifyOrganizerMagicLink } from '../../lib/organizer-api.js';
import { useOrganizerSession } from '../../hooks/use-organizer-session.js';
import { Alert } from '../../components/ui/Alert.js';

/** Deduplica POST /verify por token (Strict Mode, remounts). */
const verifyByToken = new Map<string, Promise<OrganizerSessionResponse>>();

function verifyOrganizerTokenOnce(token: string): Promise<OrganizerSessionResponse> {
  const existing = verifyByToken.get(token);
  if (existing) {
    return existing;
  }

  const request = verifyOrganizerMagicLink({ token }).then(
    (response) => response,
    (error: unknown) => {
      // Falhas transitórias não devem envenenar o token para a vida do SPA.
      // 401 (já usado/inválido) permanece memoizado para não martelar a API.
      const permanent =
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.status !== 429;
      if (!permanent) {
        verifyByToken.delete(token);
      }
      throw error;
    },
  );
  verifyByToken.set(token, request);
  return request;
}

/** Só para testes. */
export function resetOrganizerVerifyAttemptsForTests(): void {
  verifyByToken.clear();
}

export function OrganizerVerifyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  const { isLoggedIn, isLoading, setSession } = useOrganizerSession();
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(Boolean(token));

  useEffect(() => {
    if (!token || isLoading || isLoggedIn) {
      return;
    }

    let cancelled = false;
    setIsVerifying(true);
    setError(null);

    void (async () => {
      try {
        const response = await verifyOrganizerTokenOnce(token);
        if (cancelled) {
          return;
        }

        await setSession({
          sessionToken: response.sessionToken,
          email: response.email,
          expiresAt: response.expiresAt,
        });
        navigate('/organizador/painel', { replace: true });
      } catch (mutationError) {
        if (cancelled) {
          return;
        }

        if (mutationError instanceof ApiError) {
          setError(mutationError.message);
        } else {
          setError('Não foi possível validar o link de acesso.');
        }
      } finally {
        if (!cancelled) {
          setIsVerifying(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, isLoading, isLoggedIn, setSession, navigate]);

  if (isLoggedIn) {
    return <Navigate to="/organizador/painel" replace />;
  }

  if (!token) {
    return (
      <Alert variant="danger">
        Link inválido.{' '}
        <Link className="underline" to="/organizador">
          Solicitar novo link
        </Link>
      </Alert>
    );
  }

  if (isLoading || isVerifying) {
    return <p className="text-sm text-subtle">Validando link de acesso…</p>;
  }

  if (error) {
    return (
      <section className="space-y-4">
        <Alert variant="danger">{error}</Alert>
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
