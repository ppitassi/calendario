# Inventário do banco legado

Inventário realizado em 2026-08-13 antes do reset autorizado. O dump lógico fica em `backups/`, fora do Git.

| Conceito/tabelas | Classificação | Destino |
|---|---|---|
| `users` | REDESENHAR | `users`, sessões, roles, permissões e configurações do usuário |
| `agencies`, `settings` | REDESENHAR | `agency_profile`, `system_settings`, `design_tokens`; sem tenant |
| `clients` | MANTER CONCEITO | `clients`, `client_members`, `client_contacts` |
| `custom_roles` | REDESENHAR | RBAC normalizado |
| `posts` | ABSORVER NO NOVO CORE | `work_items` do tipo TASK + `content_items` |
| `post_assignments`, `post_activity_events` | ABSORVER NO NOVO CORE | responsáveis e eventos universais |
| `post_comments`, `post_revisions` | REDESENHAR | comentários e versões universais |
| `post_artwork_versions`, itens | REDESENHAR | versões de conteúdo/assets |
| `approval_tokens` | REDESENHAR | aprovação pública versionada e revogável |
| `notifications`, recipients, outbox, preferences, push | REDESENHAR | notificações baseadas em eventos de work item |
| `media_assets`, upload intents, mirror/sync/relocation | MANTER CONCEITO | assets universais e vínculos polimórficos controlados |
| `presentation_snapshots`, `presentation_pdf_jobs` | MANTER CONCEITO | apresentações derivadas de conteúdo/versionamento |
| `publication_jobs` | REDESENHAR | `publications` e jobs de publicação |
| tabelas OAuth/Meta/social | MANTER CONCEITO | integrações globais/por cliente, sem tenant |
| `deadline_alert_log`, `rate_limits` | MANTER CONCEITO | infraestrutura operacional |

Funcionalidades preservadas conceitualmente: autenticação, clientes, calendário editorial, workflow, comentários, atribuições, versões, aprovação pública, arquivos, apresentações, notificações, publicação social, configurações visuais e dashboard. Analytics legado já removido permanece fora do novo core; métricas futuras serão derivadas das entidades operacionais.
