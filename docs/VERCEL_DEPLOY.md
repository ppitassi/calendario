# Deploy na Vercel

Esta pasta é a variante serverless do Content Planner. O projeto local com PM2 e
XAMPP permanece separado.

## O que mudou

- MySQL aceita `DATABASE_URL`, TLS e pool reduzido para funções serverless.
- Rate limits ficam no MySQL e funcionam entre múltiplas instâncias.
- Imagens pequenas são persistidas no Nextcloud por WebDAV.
- Vídeos e arquivos pesados vão do navegador diretamente ao Nextcloud. Eles não
  atravessam a função da Vercel.
- PDFs são renderizados em um Browserless externo, gravados no Nextcloud e
  baixados por URL direta.
- Alertas de prazo usam Vercel Cron com `CRON_SECRET`.

## Serviços obrigatórios

1. Um MySQL público/gerenciado com TLS. O XAMPP pode continuar no desenvolvimento,
   mas não é acessível pela Vercel e não deve ser exposto na internet.
2. Nextcloud acessível por HTTPS, com WebDAV e OCS Share API.
3. Browserless acessível por WebSocket CDP para exportação de PDF.
4. Groq para a LeIA.

## Variáveis na Vercel

Configure em Project Settings > Environment Variables:

```env
APP_URL=https://seu-projeto.vercel.app
COOKIE_SECURE=true
DATABASE_URL=mysql://usuario:senha@host:3306/content_planner?ssl-mode=REQUIRED
DB_SSL_MODE=required
DB_CONNECTION_LIMIT=3

GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b

NEXTCLOUD_WEBDAV_URL=https://cloud.exemplo.com/remote.php/dav/files/USUARIO
NEXTCLOUD_OCS_URL=https://cloud.exemplo.com/ocs/v2.php/apps/files_sharing/api/v1
NEXTCLOUD_PUBLIC_DAV_URL=https://cloud.exemplo.com/public.php/dav/files
NEXTCLOUD_USERNAME=
NEXTCLOUD_APP_PASSWORD=
NEXTCLOUD_ROOT=ContentPlanner
MAX_MEDIA_UPLOAD_GB=20

BROWSERLESS_URL=wss://browserless.exemplo.com?token=SEU_TOKEN
CRON_SECRET=SEGREDO_ALEATORIO_LONGO
APP_TIMEZONE=America/Sao_Paulo

EVOLUTION_API_URL=https://evolution.exemplo.com
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE=main
```

`NEXTCLOUD_MOUNT_PATH` deve ficar vazio na Vercel: não existe disco virtual
persistente montável nas funções.

## CORS do Nextcloud

O upload pesado usa o endpoint público WebDAV. No proxy do Nextcloud, autorize
somente os domínios de produção e preview necessários, com:

- método `PUT`;
- headers `Content-Type` e `X-Requested-With`;
- preflight `OPTIONS`.

Não exponha `NEXTCLOUD_APP_PASSWORD` ao navegador. O app cria uma pasta isolada,
um compartilhamento temporário somente para upload e o revoga na finalização.

## Preparação do banco

Rode uma vez, fora da Vercel, usando a mesma `DATABASE_URL` de produção:

```bash
npm ci
npm run db:setup
```

Isso cria também `upload_intents`, `rate_limits` e `deadline_alert_log`.
Não coloque a migração no comando de build.

## Deploy

1. Envie esta pasta para um repositório Git próprio.
2. Importe o repositório na Vercel como projeto Next.js.
3. Cadastre as variáveis acima em Production e Preview.
4. Use `npm run build` como Build Command.
5. Ative Fluid Compute para a geração de PDF.
6. Faça o primeiro deploy e teste:
   - `/api/health`;
   - `/api/health/db`;
   - login e persistência de sessão;
   - upload de imagem e vídeo;
   - exportação PDF;
   - execução do cron em Production.

O cron configurado em `vercel.json` roda diariamente às 12:00 UTC, equivalente
a 09:00 em Brasília no horário padrão configurado pelo aplicativo.
