# Onboarding, marca e follow-up integrados

O fluxo usa os clientes, calendários, publicações, demandas, responsáveis,
permissões e banco existentes. Frontend e APIs continuam no mesmo Next.js.
Não há painel, ranking ou fila paralela. As sugestões de conteúdo permanecem
no fluxo de referências do calendário.

## Onde usar

- **Controle de Clientes → Editar → Onboarding, marca e resultados**: documento
  de onboarding, manual, relatórios e links de acesso do cliente.
- **Calendário → Briefing e onboarding / Consultar marca / Entregas e resultados**:
  abre o contexto do cliente mantendo o editor, sua seleção e o mês ativos.
  A consulta da marca abre a prévia; Admin e Social Media podem alternar para edição.
- **Tarefas → Detalhes**: consulta o mesmo manual. Uma revisão de resultados
  criada pelo relatório também mostra o relatório vinculado nessa aba.

## Briefing → onboarding → planejamento

1. Em **Links do cliente**, crie o link do briefing. O cliente responde sem
   login ou o executivo usa **Preencher com o cliente**.
2. O envio preenche o onboarding, arquiva as respostas e encerra o formulário.
   E-mail, WhatsApp e acessos ficam internos. Não registre senhas.
3. Revise e salve os campos. **Aplicar briefing ao planejamento** copia segmento,
   público, tom de voz e objetivos para o cadastro (objetivos entram na diretriz
   estratégica). A operação é transacional e verifica a revisão do documento.
4. Novos calendários herdam o cadastro. Rascunhos não compartilhados atualizam
   apenas campos vazios ou iguais ao valor anterior do cliente. Valores próprios,
   calendários compartilhados e calendários fora de rascunho são preservados.
   A edição normal do cadastro segue a mesma regra de sincronização.
5. A aplicação no calendário atual atualiza seu contexto sem recarregar as peças.
   Aguarde o salvamento do editor antes de abrir os recursos do cliente.

O nome da marca, os perfis e a cadência continuam no cadastro existente.
Escopo, cronograma, responsáveis e workflow permanecem no documento de kickoff;
não criam tarefas automaticamente. Os dados do cadastro preenchem o documento
inicial, evitando digitar novamente o que já existe.

## Produção → entregas → follow-up

**Entregas e resultados** consulta publicações com status **Aprovado** em
calendários completos, e tarefas com status **completed**. Não inclui
pré-calendários, itens excluídos, trabalho em produção nem a própria tarefa de
revisão. Tarefas derivadas de publicações não duplicam a contagem.

Crie um relatório: o mês ativo preenche o período e seleciona as entregas
correspondentes ao calendário e demandas concluídas do cliente. Ajuste a
seleção, registre resumo, aprendizados, próximos passos e analytics.
Os relatórios guardam referências, não cópias dos títulos/situações das peças.
A API valida cliente, situação e período. Reabrir ou excluir uma entrega a
retira do relatório público; novas entregas exigem seleção e salvamento.

A data de uma publicação é a data programada no calendário. Para tarefas,
a data é a do último evento de conclusão; registros antigos sem evento usam
`updated_at`. Aprovação não é uma confirmação de postagem na rede social.
Links **Ver no calendário** usam apenas apresentações já compartilhadas.
Materiais externos podem ser acrescentados separadamente por URL.

**Agendar revisão na fila de tarefas** abre o formulário de demanda existente,
com cliente, título e resumo preenchidos e formato **Revisão de resultados**.
Defina responsável e prazo. A demanda e sua tarefa aparecem na fila normal;
o vínculo `planning.followUpReportId` permite consultar o relatório atualizado
em Detalhes. O servidor verifica que ele pertence ao cliente selecionado.
Não há envio automático de mensagens nem agendamento em serviços externos.

## Manual da marca

O mesmo documento é usado no cadastro, no editor, nas demandas e no portal:
apresentação, paleta, tipografia, regras, tom de voz e links para logos/arquivos.
Códigos HEX de seis dígitos geram amostras visuais. Designer consulta; Admin e
Social Media editam. A publicação externa é uma opção separada da consulta interna.

## Métricas no follow-up

- Redes sociais: lançamento dos valores obtidos nas plataformas, com rede/perfil,
  métrica/unidade, fonte e período. Não há sincronização automática com Meta ou
  outras APIs; resultados nunca são inventados.
- Busdoor/outdoor: fluxo diário por unidade × dias × unidades × fator entre 0 e 1.
  Fonte e premissas são obrigatórias. O valor representa oportunidades brutas
  de exposição, com repetições, não pessoas únicas nem visualizações comprovadas.
  Dias de veiculação não podem exceder o período do relatório.

## Compartilhamento e segurança

Marque **Exibir no portal do cliente**, salve e ative o portal em **Links do
cliente**. Ele reúne onboarding publicado, relatórios/entregas, manual e
calendários já compartilhados. A prévia pode ser impressa/salva como PDF.

Portal e briefing têm tokens independentes de 256 bits. Quem possui o link
pode consultar a respectiva página. Substituir links revoga os anteriores;
desativar o portal bloqueia sua leitura. Reabrir briefing emite novo token.
Um novo envio retira o onboarding da publicação até nova revisão.

A API pública projeta somente os conteúdos publicados. Contatos, acessos,
notas internas, rascunhos e tokens de edição não são enviados. Designer recebe
403 nas tentativas de alteração do documento, compartilhamento ou aplicação
do briefing, inclusive em requisições diretas. Alterações concorrentes retornam
409. URLs aceitam apenas HTTP/HTTPS; corpos e listas têm limites.

Os links de aprovação existentes têm ciclo próprio: desativar o portal não
revoga uma apresentação compartilhada anteriormente pelo calendário.

## Instalação e verificação

As migrações aditivas `009_client_hubs` e `010_work_planning` criam
`client_hubs`, `client_briefing_submissions` e `work_units.planning`.
A integração usa essas estruturas sem apagar dados anteriores. PostgreSQL
usa migrações versionadas; SQLite aplica DDL idempotente na inicialização.

Use as configurações existentes de banco/armazenamento, faça o backup habitual
e execute `npm ci` e `npm run build`. Não é necessário outro servidor HTTP.

Em banco local descartável, com `STUDIO_TEST_BASE_URL`, `STUDIO_TEST_USERNAME`
e `STUDIO_TEST_PASSWORD` configurados:

```sh
npm run typecheck
npm run test:client-hub
npm run test:browser
npm run build
```

O teste de integração cobre formulário público, aplicação e herança do briefing,
preservação de calendários personalizados/aprovados/compartilhados, entregas
reais, revogação de aprovação, seleção inválida, privacidade, permissões,
concorrência, manutenção da seleção no editor, revisão na fila existente e
larguras de 390, 768 e 1440 pixels. As capturas usam dados sintéticos.
