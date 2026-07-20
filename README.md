# Content Planner

Aplicativo interno de operação para agências de social media e marketing digital. O projeto usa Next.js (App Router) no frontend e nas APIs, com persistência MySQL.

## Desenvolvimento

Requisitos: Node.js 20+ e MySQL.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Abra `http://localhost:3000`. Para validar uma alteração:

```bash
npm run typecheck
npm run build
```

## Deploy na Vercel

Esta cópia foi adaptada para Vercel com MySQL gerenciado, uploads diretos no
Nextcloud, PDF via Browserless e Vercel Cron. Consulte
[docs/VERCEL_DEPLOY.md](docs/VERCEL_DEPLOY.md).

O XAMPP serve apenas para desenvolvimento local; a Vercel precisa alcançar um
MySQL externo por TLS.

## Estrutura

- `app/`: páginas e Route Handlers do Next.js.
- `src/screens/`: estados de navegação da aplicação autenticada.
- `src/components/`, `src/widgets/` e `src/modals/`: interface reutilizável.
- `lib/api-core.ts`: implementação central das APIs legadas.
- `lib/review-data.ts`: DTOs públicos e validação das apresentações por token.
- `db/`: schema e conexão MySQL.

Consulte [docs/AUDITORIA_TECNICA.md](docs/AUDITORIA_TECNICA.md) para o inventário de rotas, fluxos, alterações e riscos pendentes.
