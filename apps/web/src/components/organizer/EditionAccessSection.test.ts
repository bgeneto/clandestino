import type { EditionStatus } from '@clandestino/shared-contracts';
import { describe, expect, it } from 'vitest';
import { canShareEditionAccess } from './EditionAccessSection.js';

describe('canShareEditionAccess', () => {
  it.each<EditionStatus>(['RASCUNHO', 'INSCRICOES_ABERTAS', 'SORTEIO_PUBLICADO', 'ENCERRADA'])(
    'hides sharing while the edition is %s',
    (status) => {
      expect(canShareEditionAccess(status)).toBe(false);
    },
  );

  it.each<EditionStatus>(['EM_ANDAMENTO', 'FASE_COLOCACAO'])(
    'shows sharing after matches exist in %s',
    (status) => {
      expect(canShareEditionAccess(status)).toBe(true);
    },
  );
});
