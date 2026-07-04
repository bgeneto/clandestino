import { useEffect, useState } from 'react';
import type { EditionWizardDraft } from '../db/clandestino-db.js';
import { getEditionWizardDraftByEditionId } from '../offline/edition-wizard-draft.js';

export function useEditionWizardDraft(
  editionId: string | undefined,
): EditionWizardDraft | undefined {
  const [draft, setDraft] = useState<EditionWizardDraft | undefined>();

  useEffect(() => {
    if (!editionId) {
      setDraft(undefined);
      return;
    }

    let cancelled = false;

    void getEditionWizardDraftByEditionId(editionId).then((loaded) => {
      if (!cancelled) {
        setDraft(loaded);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [editionId]);

  return draft;
}
