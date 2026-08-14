# Auditoria técnica — Content Planner

Data da revisão: 17/07/2026.

## Resumo executivo

O projeto foi convertido para uma arquitetura exclusivamente Next.js com App Router. A antiga composição SPA (`BrowserRouter`, `MemoryRouter`, `src/App.tsx` e carregamento client-only com `ssr: false`) foi removida. Não foram encontrados `vite.config.*`, `index.html`, `import.meta`, variáveis `VITE_*` nem dependência `vite`; o resíduo real era o padrão de navegação de SPA.

A revisão também reduziu código morto, dependências não utilizadas e duplicações nas APIs de apresentação/PDF. Os DTOs públicos de revisão passaram a impedir o vazamento de tokens sociais e campos internos. Isso melhora a base, mas não torna o sistema pronto para produção: autorização no servidor, multitenancy, uploads, sessões e integrações sociais ainda precisam de trabalho.

## Arquitetura e lógicas principais

- `app/` contém páginas, layouts e Route Handlers do Next.
- `app/planner-app.tsx` monta autenticação, tema, notificações e verificação de disponibilidade.
- `src/screens/PlannerScreen.tsx` mantém a máquina de navegação interna e o contexto do cliente selecionado.
- `lib/api-core.ts` centraliza a maior parte das operações HTTP e SQL.
- `lib/review-data.ts` valida tokens e produz DTOs públicos usados por one-page e PDF.
- MySQL armazena agências, usuários, clientes, posts, comentários, funções e tokens.

Estados lógicos de tela encontrados: `login`, `home`, `client_management`, `client_strategy`, `editor`, `viewer`, `data_analysis`, `analytics_growth`, `analytics_visibility`, `analytics_primetime`, `analytics_content`, `client_setup`, `admin_roles`, `user_setup` e `leia_chat`. `client_selection` está declarado no tipo, mas não forma um fluxo ativo.

## Rotas de página

| Rota | Finalidade |
| --- | --- |
| `/` | Aplicação autenticada e planner |
| `/review/[token]` | One-page público de revisão |
| `/review/[token]/export` | Documento de revisão preparado para PDF |
| `/presentation/[clientId]/[month]/export` | Apresentação mensal preparada para PDF |
| `/uploads/[...path]` | Entrega de arquivos enviados |

## Rotas de API

### Saúde e autenticação

- `GET /api/health`, `GET /api/health/db`
- `POST /api/auth/login`, `POST /api/auth/validate-token`
- `GET /api/auth/social/login/[platform]`, `GET /api/auth/callback/[platform]` — ainda retornam `501`

### Clientes, posts e comentários

- `GET|POST /api/clients`
- `GET|DELETE /api/clients/[id]`
- `POST /api/clients/[id]/meta-account`
- `POST /api/clients/[id]/send-for-review`
- `GET|POST /api/posts`
- `GET /api/posts/[clientId]`
- `DELETE /api/posts/[clientId]/[date]`
- `GET|POST /api/posts/[clientId]/comments` — o parâmetro funciona semanticamente como `postId`
- `POST /api/posts-bulk/[clientId]`

### Revisão, apresentação e PDF

- `GET|POST /api/tokens`, `GET|PATCH /api/tokens/[id]`
- `GET /api/public/review/[token]`
- `POST /api/public/review/[token]/action`
- `GET|POST /api/public/review/[token]/posts/[postId]/comments`
- `POST /api/public/review/[token]/send-whatsapp`
- `GET /api/review/[token]/export-pdf`
- `GET /api/presentation/[clientId]/[month]/export-pdf`

### Usuários, papéis e configurações

- `GET|POST /api/users`, `GET|DELETE /api/users/[uid]`
- `POST /api/users/change-password`
- `GET|POST /api/custom-roles`, `DELETE /api/custom-roles/[id]`
- `GET|POST /api/settings/[id]`
- `POST /api/agency/settings`, `GET /api/agency/settings/[id]`
- `GET /api/agencies`

### Arquivos, analytics e integrações

- `POST /api/upload-base64`, `POST /api/upload-audio`
- `GET /api/holidays/[year]`, `GET /api/geolocate`
- `GET /api/analytics/[clientId]`, `GET /api/analytics/[clientId]/posts`
- `POST /api/analytics/[clientId]/sync` — stub
- `GET /api/admin/dashboard-stats`, `GET /api/admin/workload-stats`
- `POST /api/admin/trigger-deadline-alerts` — sem implementação efetiva
- `POST /api/meta/sync/[clientId]` — stub
- `POST /api/notify-whatsapp`
- `POST /api/leia/chat`, `POST /api/generate-objective`

## Fluxos observados

1. **Autenticação:** login cria sessão; o frontend recupera o usuário e deriva seu papel. A tela permitida é controlada por permissões no cliente.
2. **Planejamento:** seleciona-se um cliente, mês e frequência; posts são criados/editados por data, com mídia, texto, status, comentários e responsável.
3. **Revisão:** um token vincula cliente e mês; o cliente visualiza uma página pública, comenta e aprova/solicita mudanças.
4. **Apresentação/PDF:** páginas de exportação são renderizadas e convertidas para PDF no servidor.
5. **Administração:** cadastro de clientes, usuários, funções customizadas e configurações da agência.
6. **Analytics:** telas consomem endpoints de perfil/posts, mas parte relevante dos dados e gráficos ainda é mock ou fixa.
7. **Integrações:** upload local e notificações existem; OAuth, sincronização e publicação Meta não estão concluídos.

## Alterações realizadas

- Removidos React Router, shell SPA legado, `src/App.tsx`, diretório `pages/` vazio e o `ssr: false` da raiz.
- Rotas públicas de revisão agora recebem o token do Next corretamente.
- Criado carregador único para revisão/apresentação e DTO público com lista explícita de campos.
- Clientes públicos não expõem access tokens, page tokens, refresh tokens ou dados internos.
- Comentários e ações públicas validam token, validade, cliente, mês e pertencimento do post.
- Rotas sensíveis de clientes, posts e tokens deixaram de ser públicas.
- `REPLACE INTO` foi substituído por upsert para impedir deleções por cascata acidentais.
- Tenant recebido do corpo é ignorado em operações que já possuem contexto autenticado.
- Estado persistido não guarda mais cliente completo nem papel informado pelo navegador.
- Download de PDF e notificação de atualização de posts foram consolidados.
- Persistência em `localStorage` foi tornada segura para SSR.
- Removidos componentes/widgets sem consumidores e métodos duplicados/inutilizados.
- Removidas dependências não utilizadas: `react-router-dom`, `react-easy-crop`, `webdav`, `autoprefixer` e `tsx`.
- Imports de animação foram unificados em `motion/react`.
- Tailwind 4 recebeu os tokens semânticos usados pela interface.
- Build deixa de ignorar erros de TypeScript; configuração PM2 executa `next start`.

## Riscos e lacunas pendentes

### Prioridade crítica

- **RBAC somente parcial:** permissões do frontend não substituem autorização em cada Route Handler. Toda ação administrativa deve validar permissão no servidor.
- **Uploads inseguros:** validar caminho canônico, MIME real, extensão, tamanho, quantidade e autorização; armazenar fora da pasta pública ou em object storage.
- **Sessão:** endurecer expiração, rotação, revogação, cookies e proteção contra abuso/brute force.
- **PDF:** aplicar rate limit, timeout, limite de concorrência e origem interna confiável para evitar DoS/SSRF.
- **Erros:** não devolver detalhes SQL, stack traces ou configuração ao navegador.

### Funcionalidade e consistência

- OAuth, sincronização Meta, publicação/agendamento e alertas de prazo estão ausentes ou simulados.
- A modelagem atual suporta essencialmente um post por cliente/data; isso limita múltiplas redes e peças no mesmo dia.
- Calendários bimestrais e trimestrais não são entidades reais; hoje o fluxo é mensal.
- Há divergência entre `assignedTo` no frontend e `assigneeId` no banco/API.
- Vocabulários de status não são uniformes entre telas, API e banco.
- Analytics contém mocks e filtros que não alteram a consulta; não deve ser apresentado como insight real.
- A rota `send-for-review` deve reutilizar integralmente o fluxo seguro de tokens.
- Salvamento a cada edição pode gerar excesso de requisições e condições de corrida; usar debounce, versão e estado de salvamento.

## Próxima etapa recomendada

Antes de implementar mais telas, criar uma camada de serviço por domínio (`auth`, `clients`, `posts`, `reviews`, `analytics`) com um guard central de sessão, tenant e permissão. Depois, normalizar posts por canal/horário e implementar um job assíncrono para publicação Meta, retries e auditoria. Essa fundação habilita calendário multi-período, aprovação rastreável e BI confiável sem ampliar a dívida do `api-core` monolítico.

## Verificações executadas

- `npm run typecheck`: aprovado.
- `npm run build`: aprovado; 49 rotas Next compiladas (página raiz estática e demais rotas dinâmicas quando necessário).
- Busca por Vite/React Router: somente as menções históricas deste documento foram encontradas.
- `npm audit`: 4 apontamentos transitivos (2 altos em `form-data` via Axios e 2 moderados em PostCSS via Next), sem correção automática indicada pelo npm. Não foi usado `--force`; acompanhar releases dos pacotes e reavaliar. O risco de `form-data` exige que nomes de campos/arquivos externos nunca sejam repassados sem validação.
