import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
    // Os testes de integração compartilham o mesmo banco PostgreSQL e
    // limpam as tabelas entre os casos; rodar arquivos em paralelo causaria
    // condições de corrida. Execução sequencial garante isolamento.
    fileParallelism: false,
  },
});
