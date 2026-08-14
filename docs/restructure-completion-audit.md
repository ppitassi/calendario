# Auditoria de conclusão da reestruturação

Data da auditoria: 14/08/2026. Banco auditado: `content_planner` em `localhost:3306`.

## Requisitos 1–24 — fundação e core universal

| Seção | Resultado | Evidência autoritativa |
|---|---|---|
| 1–4. Objetivo, unidades e checklist | Concluído | `work_items.type` restringe PROJECT/DEMAND/TASK; checklist permanece em `work_item_checklists`, sem virar Work Item. |
| 5–7. Entidade universal, hierarquia e movimentação | Concluído | `lib/work-items.ts`; validação de pai, prevenção de ciclos, mover e desvincular preservando ID/histórico; UI em `WorkManagementScreen`. |
| 8–10. Usuários, autenticação, roles e permissões | Concluído | `users`, sessões com hash/expiração/revogação, bcrypt, roles N:N e permissões; CRUD administrativo e teste de login/roles. |
| 11–13. Clientes, equipe e contatos | Concluído | `clients`, `client_members`, `client_contacts`; telas de equipe/contatos; arquivamento preserva histórico. |
| 14–15. Responsáveis e status universal | Concluído | `work_item_assignees` N:N com principal/função e remoção lógica; status universal validado na API. |
| 16–17. Workflows e editorial | Concluído | templates, estágios, transições e instância por Work Item; seed editorial; editor/calendário usam TASK + `content_items`. |
| 18–19. Histórico e auditoria | Concluído | `work_item_events` para domínio e `audit_logs` para usuários, roles, configurações, agência e clientes. |
| 20–23. Dependências, tempo, comentários e tags | Concluído | APIs, constraints, prevenção de ciclos, menções/notificações e controles na tela operacional. |
| 24. Capabilities | Concluído | conteúdo, lote fotográfico, externa, aprovação, workflow, checklist e arquivos ligados ao mesmo Work Item. |

## Requisitos 25–34 — conteúdo, calendário, publicação e aprovação

| Seção | Resultado | Evidência autoritativa |
|---|---|---|
| 25–28. Conteúdo, canais, formatos e calendário | Concluído | `content_items`, canais/formatos seeded, versões e calendário mensal como DEMAND com TASKs, sem PROJECT obrigatório. |
| 29–30. Publicações e conferência | Concluído | `publications`, `publication_jobs`, agendamento/publicação Meta, URL/ID externo e campos de verificação. |
| 31. Aprovação interna | Concluído | fluxo multi-etapas, decisões imutáveis, conclusão somente após última etapa e UI operacional. |
| 32. Aprovação pública | Concluído | token com hash/expiração/revogação, escopo de cliente/item/versões, comentários e decisão pública auditada. |
| 33. Versionamento | Concluído | `content_versions`, `asset_versions`, snapshots e autorização explícita de assets no token público. |
| 34. Notificações | Concluído | inbox, preferências, outbox, push, SSE, leitura/dismiss/toast, atribuições, menções e prazos deduplicados. |

## Requisitos 35–59 — produção e operação externa

| Seção | Resultado | Evidência autoritativa |
|---|---|---|
| 35–38. Projeto exemplo, captação, fotos e vídeos | Concluído | hierarquia flexível; `photo_jobs` guarda métricas de lote; vídeo permanece uma TASK independente com conteúdo/workflow. |
| 39–43. Capability externa e planejamento | Concluído | `external_operations` em DEMAND/TASK, tipos, briefing, agenda, local e itens operacionais categorizados. |
| 44–46. Prioridade, checklist e equipe | Concluído | itens required/blocking/priority, equipe N:N com principal/função e UI de manutenção. |
| 47–49. Estado, eventos e cálculos | Concluído | máquina completa PLANNING→COMPLETED, eventos temporais/GPS e resumo de duração, execução e atraso. |
| 50–52. Tracking, geofence preparado e gestão | Concluído | tracking somente entre início/fim da externa, indicador ativo, último GPS e raio configurável; chegada nunca é automática. |
| 53. Ocorrências | Concluído | tipos definidos, descrição/severidade e anexos universais via `file_links`. |
| 54–55. Demandas extras e reatribuição | Concluído | criação de DEMAND/TASK com IDs de origem; responsáveis pertencem ao item, não são herdados obrigatoriamente. |
| 56–57. Mobile e encerramento | Concluído | workspace responsivo com ações grandes, GPS, plano, ocorrências, extras e resumo; blocking impede finalizar e observação final é persistida. |
| 58–59. Arquivos e relações | Concluído no escopo do plano | camada universal `media_assets`/`asset_versions`/`file_links`; integração File Server/Nextcloud permanece fora de escopo conforme seção 72/Fase 10. |

## Requisitos 60–74 — configurações, produtividade, reset e aceite

| Seção | Resultado | Evidência autoritativa |
|---|---|---|
| 60–63. Configurações, agência, usuário e design | Concluído | `system_settings`, singleton de agência, `user_settings`, `design_tokens` seeded e telas existentes migradas. |
| 64. Templates | Concluído | templates de Work Item, workflow, checklist e externa, com API de criação/listagem. |
| 65. Recorrência | Concluído no nível exigido | `recurrence_definitions`, regra JSON, timezone, próximo disparo e índice; scheduler completo era explicitamente opcional. |
| 66. Dashboard e produtividade | Concluído | tarefas/demandas/projetos, atrasos, bloqueios, carga, tempo, throughput, fotos, externas e desempenho individual. |
| 67. Progresso agregado | Concluído | média simples, ponderada e manual; recálculo transacional de ancestrais. |
| 68. Soft delete e arquivamento | Concluído | usuários, clientes, itens e comentários preservam integridade/histórico; UI de arquivar/restaurar. |
| 69. Seed | Concluído | admin, roles, permissions, workflow editorial, canais, formatos, settings e design tokens. |
| 70–71. Inventário e reset | Concluído | dump/manifesto/inventário versionados; banco recriado; 65 tabelas atuais, nenhuma tabela antiga. |
| 72. Ordem de implementação | Concluído | migrations 001–012 cobrem as fases; scripts de migração legada foram removidos após substituição funcional. |
| 73. Critérios mínimos | Concluído e testado | `tests/core-api.test.mjs` cobre autenticação, roles, cliente/equipe/contato, todas as hierarquias, mover, conteúdo, aprovação, fotos e externa completa. |
| 74. Resultado arquitetural | Concluído | CLIENTE opcional + PROJECT/DEMAND/TASK flexíveis sobre `work_items`, com capabilities independentes. |

## Gates executados

- `npm run verify`: estilos, arquitetura de UI, TypeScript, oito testes de apresentação e build de produção aprovados.
- `node --test tests/core-api.test.mjs`: cenário integrado aprovado.
- `npm run test:ui:browser`: catálogo, acessibilidade básica, foco, modal, tooltip e console aprovados.
- `npm run test:ui:responsive`: login real e viewports 1440/834/390 sem overflow ou respostas 5xx; planejador e operações mobile renderizados.
- PM2: `content-planner` e `content-planner-pdf-worker` online; `/api/health/db` e login `admin/admin` retornam 200.
