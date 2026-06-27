import { Outlet, useParams } from 'react-router-dom';
import { useEditionSse } from '../../hooks/use-edition-sse.js';
import { useEdition } from '../../hooks/use-edition.js';

export function EditionLayout() {
  const { editionId } = useParams<{ editionId: string }>();
  const editionQuery = useEdition(editionId);

  useEditionSse(editionId);

  if (editionQuery.isLoading) {
    return <p className="text-sm text-slate-400">Carregando edição…</p>;
  }

  if (editionQuery.isError || !editionQuery.data) {
    return (
      <section className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-100">
        Não foi possível carregar esta edição.
      </section>
    );
  }

  return (
    <div className="-mx-4 -my-6 min-h-full flex-1 bg-slate-100 px-4 py-6 text-slate-900">
      <Outlet context={{ edition: editionQuery.data, editionId: editionQuery.data.id }} />
    </div>
  );
}

export type EditionOutletContext = {
  edition: NonNullable<ReturnType<typeof useEdition>['data']>;
  editionId: string;
};
