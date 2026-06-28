# 1782686083422-fix-organizer-login-error-alert.md

## Problema

Em `apps/web/src/pages/organizer/OrganizerLoginPage.tsx` (linhas 74-78), a mensagem de erro retornada pela API (ex: "Este e-mail não está autorizado a acessar o painel do organizador.") é renderizada como um `<div>` neutro com styling genérico (`border border-line bg-card p-4 text-sm text-muted`), parecendo texto comum ao invés de um alerta de erro visível.

## Solução

Substituir o `<div>` genérico por um `<section>` com styling de alerta de perigo (danger), seguindo o padrão já estabelecido em `OrganizerVerifyPage.tsx` (linhas 62-73).

## Alterações

**Arquivo:** `apps/web/src/pages/organizer/OrganizerLoginPage.tsx`

**Linhas 74-78** — substituir:

```tsx
// ANTES (neutro, não parece erro)
{
  feedback ? (
    <div className="rounded-2xl border border-line bg-card p-4 text-sm text-muted">{feedback}</div>
  ) : null;
}
```

**POR:**

```tsx
// DEPOIS (alerta de perigo, consistente com OrganizerVerifyPage)
{
  feedback ? (
    <section className="space-y-4 rounded-2xl border border-danger-surface bg-danger-surface p-6 text-sm text-danger-foreground">
      <p>{feedback}</p>
      <Link
        className="inline-block rounded-lg bg-brand px-4 py-2 font-medium text-white"
        to="/organizador"
      >
        Solicitar novo link
      </Link>
    </section>
  ) : null;
}
```

## Detalhes

- **Styling:** Usa as mesmas classes de perigo já existentes no tema (`danger-surface`, `danger-foreground`)
- **UX adicional:** Inclui botão "Solicitar novo link" que redireciona para `/organizador` (mesma página de login)
- **Consistência:** Segue o mesmo padrão visual de `OrganizerVerifyPage.tsx` para erros de autenticação
- **Zero breaking changes:** A prop `feedback` já existe e é usada pelo `useMutation.onError`

## Validação

1. `pnpm typecheck` — verificar que não há erros de tipo
2. `pnpm --filter @clandestino/web test` — testes do web passam
3. Verificação visual: mensagem de erro aparece com fundo/cores de perigo e botão de ação
