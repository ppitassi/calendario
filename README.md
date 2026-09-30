# Calendário — Presentation Studio

Aplicação independente em Next.js para criar calendários editoriais, editar
peças, revisar o resultado e apresentar o planejamento. O estado fica em
SQLite e os uploads ficam em um volume separado do código.

## Desenvolvimento local

Requisitos: Node.js 22.13 ou superior (abaixo da versão 25) e npm.

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Abra `http://localhost:3010`. No primeiro uso local, sem senha configurada, o
terminal informa a credencial temporária. Não reutilize essa credencial com
dados reais.

## Preparação do servidor

O exemplo abaixo considera Linux, Nginx e o usuário de serviço `calendario`.
Troque domínio, usuário e caminhos para os valores do servidor.

1. Instale Node.js 22, npm, Nginx e Git.
2. Clone o repositório em `/srv/calendario` e instale todas as dependências:

```bash
git clone https://github.com/ppitassi/calendario.git /srv/calendario
cd /srv/calendario
npm ci
```

O PM2 é uma dependência de desenvolvimento fixada no lockfile; não é necessário
instalá-lo globalmente.

3. Crie volumes fora do diretório da aplicação e conceda acesso somente ao
usuário do processo:

```bash
sudo install -d -o calendario -g calendario -m 0750 \
  /var/lib/presentation-studio/data \
  /var/lib/presentation-studio/uploads
```

4. Crie o arquivo sigiloso e restrinja sua leitura:

```bash
cp .env.example .env.production.local
chmod 600 .env.production.local
```

Preencha pelo menos:

```dotenv
PORT=3010
HOSTNAME=127.0.0.1
STUDIO_DATA_DIR=/var/lib/presentation-studio/data
STUDIO_UPLOAD_DIR=/var/lib/presentation-studio/uploads
STUDIO_ADMIN_USERNAME=admin
STUDIO_ADMIN_NAME=Administrador
STUDIO_ADMIN_PASSWORD=use-uma-senha-unica-com-12-ou-mais-caracteres
STUDIO_UPLOAD_MAX_MB=10
```

A senha do ambiente só cria o primeiro administrador; mudar essa variável não
altera a senha de uma conta já existente. Guarde-a como segredo porque ela será
usada se um banco vazio for restaurado.

## Build e início com PM2

```bash
npm run production:check
npm run typecheck
npm run build
npm run pm2:start
npm run pm2:status
curl --fail http://127.0.0.1:3010/api/health
```

O `postbuild` prepara `.next/standalone` e interrompe o build se detectar banco,
WAL, uploads, logs ou outro estado local dentro do release. Como o SQLite só
aceita uma instância de escrita nesta arquitetura, o ecosystem fixa `instances: 1`.

Para restaurar o PM2 depois do boot:

```bash
npm run pm2:startup
# Execute exatamente o comando privilegiado impresso pelo PM2.
npm run pm2:save
```

Comandos operacionais:

```bash
npm run pm2:status
npm run pm2:logs
npm run pm2:stop
```

## Proxy HTTPS e logs

Use [`deploy/nginx.conf.example`](deploy/nginx.conf.example) como base, substitua
o domínio e os caminhos do certificado, valide com `sudo nginx -t` e recarregue
o Nginx. A porta 3010 deve aceitar conexões apenas de `127.0.0.1`; o acesso
externo deve passar por HTTPS.

Os arquivos de PM2 em `logs/` precisam de rotação. Ajuste os caminhos e o usuário
em [`deploy/logrotate.conf.example`](deploy/logrotate.conf.example), copie-o para
`/etc/logrotate.d/presentation-studio` e teste com:

```bash
sudo logrotate --debug /etc/logrotate.d/presentation-studio
```

## Atualização

```bash
cd /srv/calendario
git pull --ff-only
npm ci
npm run production:check
npm run typecheck
npm run build
npm run pm2:start
curl --fail http://127.0.0.1:3010/api/health
npm run pm2:save
```

O código pode ser substituído, mas estes caminhos precisam sobreviver a todo
deploy:

- `STUDIO_DATA_DIR/studio.db` e seus arquivos WAL/SHM;
- todo o conteúdo de `STUDIO_UPLOAD_DIR`;
- `.env.production.local`, mantido fora de artefatos e backups públicos.

## Backup e restauração

Para uma cópia simples e consistente, pare a única instância antes de copiar os
volumes. Isso inclui SQLite, WAL/SHM e uploads no mesmo ponto no tempo:

```bash
npm run pm2:stop
sudo tar -C /var/lib -czf /var/backups/presentation-studio-$(date +%F-%H%M).tar.gz \
  presentation-studio/data presentation-studio/uploads
npm run pm2:start
curl --fail http://127.0.0.1:3010/api/health
```

Para restaurar, pare o processo, preserve o estado atual, extraia o backup para
`/var/lib`, restaure proprietário/permissões, inicie e confira `/api/health`.
Teste periodicamente a restauração em outro diretório; um backup nunca testado
não é uma garantia de recuperação.

## Verificações técnicas

```bash
npm run typecheck
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
npm run build
npm audit --audit-level=moderate
```

Com o servidor local em execução, o teste de navegador autentica, cria uma
fixture reservada e percorre editor, prévia e apresentação:

```bash
STUDIO_TEST_BASE_URL=http://localhost:3010 \
STUDIO_TEST_USERNAME=admin \
STUDIO_TEST_PASSWORD='a-senha-do-ambiente' \
npm run test:browser
```

No PowerShell, defina cada variável com `$env:NOME='valor'`. Se o navegador não
estiver em um caminho conhecido, defina `STUDIO_BROWSER_EXECUTABLE_PATH`. Por
segurança, o teste recusa hosts remotos, salvo quando
`STUDIO_TEST_ALLOW_REMOTE=1` é informado conscientemente para um ambiente
descartável.

Uploads autenticados aceitam apenas imagens raster reconhecidas. SVG, nomes de
arquivo enviados pelo navegador e conteúdo local nunca são incluídos no Git ou
no bundle de produção.
