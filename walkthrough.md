# Walkthrough: uploads, Nextcloud e customização

## Storage

- Imagens, logos, avatares e assets de interface são armazenados no servidor em
  `server/uploads/<tenant>/...`; o banco guarda somente suas URLs.
- Vídeos e outras mídias pesadas usam `PUT /api/uploads/media` com streaming.
- Com `NEXTCLOUD_MOUNT_PATH`, o arquivo é escrito diretamente no disco montado.
- Sem mount, a aplicação usa WebDAV e cria um link público pelo OCS do Nextcloud.
- O player recebe a URL final do Nextcloud e reproduz diretamente de lá.
- Se o Nextcloud não estiver configurado, há fallback local tenant-isolado.

## Configuração recomendada no servidor

```env
NEXTCLOUD_MOUNT_PATH=/mnt/nextcloud
NEXTCLOUD_PUBLIC_BASE_URL=https://cloud.exemplo.com/s/SEU_LINK/download?path=
NEXTCLOUD_ROOT=ContentPlanner
MAX_MEDIA_UPLOAD_GB=20
```

Se o mount não expuser uma URL pública previsível, configure também
`NEXTCLOUD_OCS_URL`, `NEXTCLOUD_USERNAME` e `NEXTCLOUD_APP_PASSWORD`;
use uma senha de aplicativo, nunca a senha pessoal.

No proxy reverso e no Nextcloud, configure o limite de corpo acima do maior vídeo
esperado e timeouts compatíveis. O endpoint da aplicação valida sessão, tenant,
cliente, MIME, extensão e tamanho antes de aceitar o arquivo.

## Preferências e identidade visual

- Tema, densidade, idioma, notificações, widgets, LeIA e sidebar ficam no banco,
  em `users.ui_preferences`, e não no armazenamento do navegador.
- A identidade da agência vem de `agencies.theme_config`.
- A cor primária do tenant alimenta as utilities Tailwind, incluindo opacidades
  como `bg-primary/10`, além dos fundos e superfícies por modo claro/escuro.
