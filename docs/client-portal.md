# Portal do cliente e operação da agência

O módulo usa o cadastro de clientes, a sessão, o banco e a fila de tarefas do
Calendário. Frontend e APIs continuam no mesmo processo Next.js.

## Fluxo de uso

1. Abra **Clientes → Ficha & Portal**. Crie o link de briefing na visão geral.
2. Copie o link ou escolha **Preencher com o cliente**. O cliente pode responder
   sem login; o executivo também pode preencher junto com ele.
3. O envio preenche **Kickoff & onboarding**, registra uma cópia das respostas
   e encerra o formulário. A equipe revisa escopo, cronograma, responsabilidades
   e aprovações. Um novo envio exige **Reabrir com novo link**.
4. Em **Entregas & follow-up**, cadastre materiais e relatórios por período.
   Cada relatório contém resumo, métricas sociais, mídia exterior, aprendizados
   e próximos passos. Os materiais usam links para seus arquivos existentes.
5. Em **Manual da marca**, preencha apresentação, cores, tipografia, tom de voz,
   regras e links para logos, aplicações e arquivos. Códigos HEX de seis dígitos
   geram amostras visuais da paleta.
6. Marque **Exibir no portal do cliente** em cada conteúdo desejado e salve.
   Ative o portal na visão geral e compartilhe o link. As seções públicas são
   onboarding, entregas/follow-up, manual e calendários já compartilhados.
7. Em **Relacionamento**, agende follow-ups com responsáveis, datas, objetivo,
   link de reunião, mensagem e resultado. Anotações dessa área são internas.
   WhatsApp e e-mail abrem a mensagem para revisão e envio pelo operador.

O botão **Imprimir / salvar PDF** exporta a seção atual pelo navegador.
Alterações na ficha precisam de **Salvar ficha**. A interface sinaliza mudanças
pendentes e avisa antes de sair. Revisões concorrentes recebem conflito, sem
substituir silenciosamente o conteúdo de outra sessão.

## Painel e planejamento

**Painel da Agência** consolida tarefas dos calendários e demandas, prazos,
pendências de aprovação, follow-ups e ranking de entregas. Designers veem seu
próprio trabalho no painel. Tarefas originadas de publicações não são contadas
duas vezes. O ranking mensal usa o último evento de conclusão; registros antigos
sem evento aparecem apenas em **Todo o período**. A atribuição é ao responsável
atual. Pontos de esforço em aberto não representam percentual de capacidade.

**Nova tarefa** reutiliza a criação de demandas, com solicitante, especialidade,
categoria, esforço por entrega, formato de atendimento e horário limite. Esses
dados ficam disponíveis na aba **Detalhes** da demanda. Quantidade gera tarefas
reais, com os responsáveis e prazos do fluxo existente. Demandas exigem cliente.

**Oportunidades de Conteúdo** consulta o calendário de referências existente e
aceita tema manual. Oferece modelos revisáveis de Reel, carrossel, Stories e
Live, com etapa do funil, gancho, estrutura e chamada. A seleção cria uma demanda
intitulada **Campanha: [tema]**, com uma tarefa por ideia na fila existente.
Os modelos não usam geração por IA. Tipo de produção de Live é vídeo e de
carrossel/Stories é Feed/Story; o formato detalhado permanece no briefing.

## Dados e métricas

- **Redes sociais:** lançamento manual de valores obtidos nas plataformas,
  com rede/perfil, nome e unidade da métrica, fonte e período do relatório.
  Não há conexão automática com Meta, Instagram ou outras APIs nesta entrega.
- **Busdoor/outdoor:** fluxo diário por unidade × dias × unidades × fator de
  exposição entre 0 e 1. Fonte e premissas são obrigatórias. O resultado é uma
  estimativa bruta de oportunidades de exposição, sujeita a repetições; não é
  alcance único nem visualização comprovada. Dias não podem exceder o período.
- Não há números fictícios no produto. Estados vazios permanecem vazios.
- Os exemplos das capturas automatizadas são dados sintéticos de teste.

## Acesso e publicação

Admin e Social Media editam e publicam. Designer consulta a ficha e recebe
`403` nas tentativas de alteração, inclusive por requisição direta. O executivo
usa um dos perfis de edição já existentes; não foi criado um novo papel.

Portal e briefing têm tokens independentes de 256 bits. Quem possui o link tem
acesso à respectiva página. O portal começa desativado. **Substituir links**
revoga os dois links anteriores; **Desativar portal** bloqueia a leitura do
portal; **Encerrar formulário** bloqueia novos envios do briefing.

A API pública envia apenas conteúdos marcados para publicação. E-mail, telefone,
acessos, anotações internas, follow-ups internos, rascunhos e tokens de edição
não são enviados. O formulário público não permite consultar respostas antigas.
Um novo briefing retira o onboarding da publicação até a equipe revisá-lo.
Páginas usam noindex/no-referrer e respostas de API usam no-store.

Links existentes de aprovação de calendário mantêm seu ciclo próprio: revogar
o portal não revoga uma apresentação que já foi compartilhada pelo calendário.
O portal não adiciona gestão financeira, funil comercial ou envio automático de
mensagens; o painel apresenta apenas dados operacionais existentes.

## Persistência e instalação

As migrações aditivas `009_client_hubs` e `010_work_planning` criam
`client_hubs`, `client_briefing_submissions` e `work_units.planning`.
PostgreSQL usa o inicializador versionado existente; SQLite aplica o DDL
idempotente na inicialização. Não é necessário outro serviço HTTP.

Faça o backup habitual do banco antes de atualizar o servidor. Use as mesmas
variáveis de banco e armazenamento já configuradas e execute `npm ci` e
`npm run build`. A inicialização de runtime também verifica as migrações.
Os testes não devem apontar para o banco de produção.

## Verificação local

Use dois terminais, com diretórios e credenciais descartáveis:

```powershell
$env:STUDIO_DATA_DIR = 'C:\temp\calendario-hub-test\data'
$env:STUDIO_UPLOAD_DIR = 'C:\temp\calendario-hub-test\uploads'
$env:STUDIO_ADMIN_USERNAME = 'hub-test'
$env:STUDIO_ADMIN_PASSWORD = '<senha-de-teste-com-12-ou-mais-caracteres>'
node node_modules/next/dist/bin/next dev --port 3011
```

Remova as variáveis PostgreSQL nesse ambiente caso queira usar o SQLite
descartável; `DATABASE_URL` ou `POSTGRES_URL` têm precedência sobre esses diretórios.

```powershell
$env:STUDIO_TEST_BASE_URL = 'http://localhost:3011'
$env:STUDIO_TEST_USERNAME = 'hub-test'
$env:STUDIO_TEST_PASSWORD = '<a-mesma-senha-de-teste>'
npm run test:client-hub
npm run test:browser
npm run typecheck
```

`test:client-hub` cobre formulário público, documento preenchido, edição pela UI,
reabertura, duas submissões concorrentes, conflitos de edição, publicação,
validações, permissões, revogação, planejamento da demanda, ranking, campanha e
larguras 390/768/1440. Salva capturas e `verification.json` em
`artifacts/client-hub` (ignorado pelo Git). Requer Chromium instalado; use
`STUDIO_BROWSER_EXECUTABLE_PATH` se a localização não for detectada.

`test:browser` verifica o calendário existente: seleção na grade, edição,
persistência e apresentação. Pare o servidor de desenvolvimento antes de
executar o build, para não compartilhar o cache `.next` entre os dois processos.
