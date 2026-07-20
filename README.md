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

## Produção com PM2

O processo de produção é administrado pelo PM2; não use `npm start`. Depois de instalar as dependências e preencher `.env.local`, execute:

```bash
node server/setupDb.cjs
node node_modules/next/dist/bin/next build
pm2 startOrReload ecosystem.config.js --env production
pm2 save
pm2 startup
```

Atualizações usam o mesmo fluxo de build e `pm2 startOrReload ecosystem.config.js --update-env`. Consulte logs com `pm2 logs content-planner` e o estado com `pm2 status`. O Next escuta somente em `127.0.0.1:3006`; publique-o atrás de Nginx/Caddy com HTTPS.

O projeto mantém uma instância PM2 porque rate limits e arquivos ainda são locais. Cluster deve ser ativado somente após migrar esses estados para Redis e object storage.

## Estrutura

- `app/`: páginas e Route Handlers do Next.js.
- `src/screens/`: estados de navegação da aplicação autenticada.
- `src/components/`, `src/widgets/` e `src/modals/`: interface reutilizável.
- `lib/api-core.ts`: implementação central das APIs legadas.
- `lib/review-data.ts`: DTOs públicos e validação das apresentações por token.
- `db/`: schema e conexão MySQL.

Consulte [docs/AUDITORIA_TECNICA.md](docs/AUDITORIA_TECNICA.md) para o inventário de rotas, fluxos, alterações e riscos pendentes.
