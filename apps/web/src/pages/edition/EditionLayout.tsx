import { useEffect } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Alert } from '../../components/ui/Alert.js';
import { useEditionSync } from '../../hooks/use-edition-sync.js';
import { useEdition } from '../../hooks/use-edition.js';
import { isEditionGone } from '../../lib/api-errors.js';
import { purgeEditionLocalState } from '../../lib/purge-edition-state.js';

export function EditionLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { editionId } = useParams<{ editionId: string }>();
  const editionQuery = useEdition(editionId);

  const editionGone = editionQuery.isError && isEditionGone(editionQuery.error);

  useEditionSync(editionId, editionQuery.isSuccess, editionQuery.data?.championshipId);

  useEffect(() => {
    if (!editionGone || !editionId) {
      return;
    }

    void purgeEditionLocalState(editionId, queryClient).then(() => {
      navigate('/?edicao=nao-encontrada', { replace: true });
    });
  }, [editionGone, editionId, navigate, queryClient]);

  if (editionQuery.isLoading) {
    return <p className="text-sm text-subtle">Carregando edição…</p>;
  }

  if (editionGone) {
    return <p className="text-sm text-subtle">Edição não encontrada…</p>;
  }

  if (editionQuery.isError || !editionQuery.data) {
    return <Alert variant="danger">Não foi possível carregar esta edição.</Alert>;
  }

  return <Outlet context={{ edition: editionQuery.data, editionId: editionQuery.data.id }} />;
}

export type EditionOutletContext = {
  edition: NonNullable<ReturnType<typeof useEdition>['data']>;
  editionId: string;
};
