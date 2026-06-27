import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ApiError } from '../../lib/api-client.js';
import { requestOrganizerMagicLink } from '../../lib/organizer-api.js';
import { useOrganizerSession } from '../../hooks/use-organizer-session.js';

export function OrganizerLoginPage() {
  const { isLoggedIn } = useOrganizerSession();
  const [email, setEmail] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);

  const requestMutation = useMutation({
    mutationFn: () => requestOrganizerMagicLink({ email: email.trim() }),
    onSuccess: (response) => {
      setFeedback(response.message);
      setDevLink(response.magicLink ?? null);
    },
    onError: (error) => {
      setDevLink(null);
      if (error instanceof ApiError) {
        setFeedback(error.message);
        return;
      }

      setFeedback('Não foi possível solicitar o link de acesso.');
    },
  });

  if (isLoggedIn) {
    return <Navigate to="/organizador/painel" replace />;
  }

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-xl font-semibold text-white">Painel do organizador</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Informe o e-mail autorizado para receber um link de acesso seguro.
        </p>
      </div>

      <form
        className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          setFeedback(null);
          setDevLink(null);
          void requestMutation.mutateAsync();
        }}
      >
        <label className="block space-y-2 text-sm">
          <span className="text-slate-300">E-mail</span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-white outline-none ring-brand focus:ring-2"
            placeholder="organizador@fitpong.com"
          />
        </label>

        <button
          type="submit"
          disabled={requestMutation.isPending}
          className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white disabled:opacity-60"
        >
          {requestMutation.isPending ? 'Enviando…' : 'Enviar link de acesso'}
        </button>
      </form>

      {feedback ? (
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-200">
          {feedback}
        </div>
      ) : null}

      {devLink ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <p className="font-medium">Link de desenvolvimento</p>
          <Link
            className="mt-2 block break-all underline"
            to={devLink.replace(/^https?:\/\/[^/]+/, '')}
          >
            {devLink}
          </Link>
        </div>
      ) : null}

      <p className="text-center text-sm text-slate-500">
        <Link className="text-slate-300 underline" to="/">
          Voltar ao início
        </Link>
      </p>
    </section>
  );
}
