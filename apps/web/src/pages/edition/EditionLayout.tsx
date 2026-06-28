import { Outlet, useParams } from 'react-router-dom';
import { useEditionSse } from '../../hooks/use-edition-sse.js';
import { useEdition } from '../../hooks/use-edition.js';

export function EditionLayout() {
  const { editionId } = useParams<{ editionId: string }>();
  const editionQuery = useEdition(editionId);

  useEditionSse(editionId);

  if (editionQuery.isLoading) {
    return <p className="text-sm text-subtle">Carregando edição…</p>;
  }

  if (editionQuery.isError || !editionQuery.data) {
    return (
      <section className="rounded-2xl border border-danger-surface bg-danger-surface p-6 text-sm text-danger-foreground">
        Não foi possível carregar esta edição.
      </section>
    );
  }

  return <Outlet context={{ edition: editionQuery.data, editionId: editionQuery.data.id }} />;
}

export type EditionOutletContext = {
  edition: NonNullable<ReturnType<typeof useEdition>['data']>;
  editionId: string;
};
