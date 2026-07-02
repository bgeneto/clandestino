import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { DEFAULT_EDITION_RULES, DEFAULT_SCORING_TABLE } from '@clandestino/shared-contracts';
import { createChampionship } from '../../lib/organizer-api.js';
import { notifyApiError } from '../../notifications/notify-api-error.js';
import { useNotification } from '../../notifications/notification-context.js';

export function CreateChampionshipPage() {
  const navigate = useNavigate();
  const notify = useNotification();
  const [name, setName] = useState('');

  const createMutation = useMutation({
    mutationFn: () =>
      createChampionship({
        name: name.trim(),
        scoringTable: DEFAULT_SCORING_TABLE,
        defaultEditionRules: DEFAULT_EDITION_RULES,
      }),
    onSuccess: (championship) => {
      void navigate(`/organizador/campeonato/${championship.id}`);
    },
    onError: (mutationError) => {
      notifyApiError(notify, mutationError, 'Não foi possível criar o campeonato.');
    },
  });

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-line bg-card p-6">
        <Link className="text-sm text-subtle underline" to="/organizador/painel">
          ← Voltar ao painel
        </Link>
        <h2 className="mt-3 text-xl font-semibold text-foreground">Novo campeonato</h2>
        <p className="mt-2 text-sm text-muted">
          Crie um campeonato com ranking e pontuação próprios.
          <br />
          Atribua um nome abaixo, como &quot;Clandestino 2026 - Águas Claras&quot;.
        </p>
      </div>

      <form
        className="space-y-4 rounded-2xl border border-line bg-card p-6"
        onSubmit={(event) => {
          event.preventDefault();
          void createMutation.mutateAsync();
        }}
      >
        <label className="block space-y-2 text-sm">
          <span className="text-muted">Nome do campeonato</span>
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-lg border border-line bg-card-muted px-3 py-2.5 text-foreground"
            placeholder="Clandestino 2026 - Águas Claras"
          />
        </label>

        <p className="text-xs text-subtle">
          A tabela de pontuação padrão (1º a 20º) e regras padrão de edição serão aplicadas. Você
          pode ajustar depois no hub do campeonato.
        </p>

        <button
          type="submit"
          disabled={createMutation.isPending}
          className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white disabled:opacity-60"
        >
          {createMutation.isPending ? 'Criando…' : 'Criar campeonato'}
        </button>
      </form>
    </section>
  );
}
