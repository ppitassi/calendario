# Home, prazo global dos calendários e ajustes de navegação

## Objetivo

Criar uma Home que ajude cada pessoa a entender o que precisa de atenção e por onde começar. A página deve reunir trabalho individual, pendências e o compromisso global de entrega dos calendários.

A Home segue o **Role-based Workspace**, com conteúdo adequado à Social Media e ao Designer, utilizando os mesmos dados do sistema e respeitando as permissões de cada usuário.

## 1. Estrutura da Home

Organizar a página nos seguintes blocos:

1. Prazo global dos calendários.
2. Precisa de atenção.
3. Meu trabalho de hoje.
4. Próximos 7 dias.
5. Continuar de onde parei.

O prazo global fica em destaque. Os demais blocos ajudam a transformar esse compromisso em ações individuais.

## 2. Prazo global dos calendários

**Todos os calendários de todos os designers vinculados ao mesmo ciclo possuem o mesmo prazo final de entrega.**

Não cadastrar uma data de entrega independente para cada calendário. Configurar uma única data no ciclo e utilizá-la como referência em todos os calendários vinculados.

Exemplo ilustrativo:

> **Entrega dos calendários de novembro**  
> **Prazo geral: sexta-feira, 09/10/2026**  
> Todos os designers devem concluir seus calendários até essa data.

### Configuração e comportamento

- Cadastrar o prazo uma única vez por ciclo, por usuário autorizado.
- Vincular cada calendário ao ciclo correspondente.
- Ao alterar o prazo do ciclo, atualizar a referência exibida para todos os calendários vinculados, sem edição individual.
- Exibir a data completa junto de indicações como “Entrega hoje”, “Entrega nesta semana” ou “Prazo vencido”, conforme o caso.
- Usar texto além de cor para indicar a situação.
- Não apresentar uma entrega já concluída como atrasada apenas porque o prazo do ciclo passou.

### Acompanhamento abaixo do prazo

| Visão | Conteúdo |
| --- | --- |
| Visão geral, conforme permissão | Quantidade de calendários entregues e pendentes, com detalhamento por designer |
| Designer | Seus calendários entregues e pendentes, sempre com o mesmo prazo global |

Permitir filtrar o acompanhamento por cliente e designer, conforme as permissões. Os filtros alteram os itens apresentados, não o prazo compartilhado.

Cada calendário pode mostrar cliente, responsável, situação e progresso das tarefas. Clicar no calendário abre a drawer com suas subdemandas e respectivas situações.

### Relação com os prazos das tarefas

As tarefas podem ter prazos operacionais próprios para organizar a produção: por exemplo, copy na terça e design na quinta. O compromisso final dos calendários continua sendo a sexta-feira definida para todo o ciclo.

- Alterar o prazo global não altera automaticamente os prazos operacionais das tarefas.
- Sinalizar tarefas previstas para depois do prazo global.
- Não considerar um calendário entregue apenas porque todas as tarefas foram concluídas: respeitar a etapa de aprovação/entrega prevista no fluxo.
- Exibir progresso das tarefas e situação de entrega do calendário como informações distintas.

## 3. Conteúdo por função

| Bloco | Social Media | Designer |
| --- | --- | --- |
| **Precisa de atenção** | Copies pendentes, ajustes solicitados e publicações sem responsável | Artes com ajustes, tarefas atrasadas e demandas sem briefing ou copy liberado |
| **Meu trabalho de hoje** | Publicações para escrever ou revisar, ordenadas por prazo | Artes para produzir ou finalizar, ordenadas por prazo |
| **Próximos 7 dias** | Publicações previstas e situação do conteúdo | Tarefas e entregas individuais previstas, com situação da produção |
| **Continuar de onde parei** | Últimos calendários e copies acessados | Últimas tarefas e arquivos acessados |

O bloco global acompanha o compromisso compartilhado do ciclo. “Meu trabalho” e “Próximos 7 dias” organizam as atividades individuais necessárias para cumpri-lo.

## 4. Navegação e permissões

Cada item da Home deve levar diretamente ao contexto de trabalho correspondente:

- Clicar em uma tarefa abre seus detalhes na drawer.
- No acompanhamento global, clicar em um calendário abre a drawer com suas subdemandas.
- Disponibilizar a ação explícita “Abrir calendário” para entrar no planejamento mensal.
- Nos atalhos de calendários recentes, abrir diretamente o planejamento mensal.
- Social Media autorizada pode escrever e editar o copy.
- Designer pode visualizar, selecionar e copiar o texto, sem alterá-lo.
- Para usuários com ambas as funções, oferecer um seletor **Social Media / Designer**, adaptando a Home ao workspace escolhido.

A troca de workspace não concede permissões adicionais. O acesso às demandas e às ações deve respeitar as autorizações existentes.

## 5. Organização visual sugerida

```text
Bom dia, Leonardo                         + Criar demanda

ENTREGA DOS CALENDÁRIOS DE NOVEMBRO
Prazo geral: sexta-feira, 09/10/2026
Calendários entregues e pendentes
[Ver acompanhamento por designer]

PRECISA DE ATENÇÃO
[2 ajustes solicitados] [1 tarefa atrasada]

MEU TRABALHO DE HOJE
Demanda / Cliente                Prazo       Situação
Campanha Outubro · Ativa         Hoje        Escrever copy
Post Institucional · Cliente B   Hoje        Ajustar
Carrossel · Cliente C            Amanhã      Em produção

PRÓXIMOS 7 DIAS                  CONTINUAR DE ONDE PAREI
Atividades agrupadas por dia     Calendário Novembro · Ativa
                                Última tarefa acessada
```

Datas, nomes e contagens acima são exemplos ilustrativos. Os itens e ações reais devem refletir a função e as permissões do usuário.

Em larguras menores, empilhar os blocos e preservar o destaque do prazo global. Evitar comprimir listas e informações de entrega em colunas estreitas.

## 6. Diretrizes de conteúdo

- Começar com blocos de ação e acompanhamento, sem necessidade de gráficos no primeiro momento.
- Priorizar contadores úteis, como “3 copies precisam de ajuste”, em vez de números genéricos como “total de demandas”.
- Fazer os contadores funcionarem como filtros ou atalhos para os itens correspondentes.
- Quando não houver pendências, mostrar “Tudo em dia” e as próximas atividades, sem inventar urgência.
- Manter clara a diferença entre prazo global do ciclo, prazo operacional da tarefa e situação de entrega de cada calendário.

## 7. Ajustes de navegação — demandas agrupadas, lista e Kanban

### Tela de lista: expandir a demanda mãe

Na tela de lista, clicar em uma demanda agrupada do tipo calendário deve expandir suas tarefas logo abaixo, como um dropdown/accordion. A demanda mãe continua visível, com todas as subdemandas acessíveis dentro do agrupamento.

- Exibir um indicador de expansão e a quantidade de tarefas vinculadas.
- Permitir expandir e recolher o grupo sem sair da lista.
- Mostrar nas tarefas as informações relevantes de título, responsável, prazo operacional e situação.
- Clicar em uma tarefa abre seus detalhes, respeitando as permissões de cada função.
- Disponibilizar “Abrir calendário” como uma ação separada; clicar para expandir a demanda mãe não deve levar automaticamente ao editor.
- Preservar filtros, posição e grupos expandidos ao fechar os detalhes de uma tarefa.

### Tela de Kanban: subdemandas na própria drawer

Na tela de Kanban, clicar no card da demanda mãe deve abrir seus detalhes e mostrar as subdemandas na própria drawer.

- Ao selecionar uma subdemanda, seus detalhes aparecem nessa mesma drawer, com uma opção para voltar à demanda mãe.
- Se o Kanban já estiver dentro de uma drawer, reutilizar essa drawer para abrir o card e suas subdemandas, sem abrir outra por cima.
- Ao voltar à demanda mãe, preservar o contexto das subdemandas. Ao fechar a drawer, preservar o contexto do Kanban de origem.
- Em telas menores, adaptar a largura da drawer para manter o conteúdo legível e as ações acessíveis.

### Editor de calendário: remover lista e Kanban internos

Remover as visões de lista e Kanban de dentro do editor de calendário, incluindo suas abas e alternadores. O editor fica dedicado ao calendário mensal e à edição contextual de copy.

As telas de lista e Kanban da gestão de demandas/Meu Trabalho continuam disponíveis, com os comportamentos descritos acima. Todas as visualizações utilizam as mesmas demandas e tarefas, sem duplicar registros.

### Permissões em todas as entradas

Social Media autorizada pode editar o copy. Designer pode apenas visualizar, selecionar e copiar o texto. Essa regra vale ao abrir uma tarefa pela Home, lista, Kanban ou drawer, e deve ser validada também no servidor.

## 8. Critérios de aceite

- [ ] A Home apresenta conteúdo adequado à função selecionada.
- [ ] Existe uma única data de entrega por ciclo, compartilhada por todos os calendários de todos os designers vinculados.
- [ ] Alterar essa data atualiza a referência de todos os calendários do ciclo, sem edição individual.
- [ ] A visão geral permite acompanhar calendários entregues e pendentes por designer, conforme permissão.
- [ ] Cada Designer consegue acompanhar seus próprios calendários e o mesmo prazo global.
- [ ] Prazos das tarefas continuam independentes; datas posteriores ao prazo global são sinalizadas.
- [ ] Conclusão das tarefas não substitui indevidamente a etapa de aprovação/entrega do calendário.
- [ ] Os blocos de atenção, trabalho do dia, próximos 7 dias e recentes levam aos itens correspondentes.
- [ ] Social Media pode editar copy; Designer apenas lê e copia, inclusive ao acessar uma tarefa pela Home.
- [ ] Estados vazios e entregas concluídas não exibem urgência ou atraso incorretos.
- [ ] Clicar na demanda agrupada na lista expande/recolhe suas subdemandas sem abrir automaticamente o calendário.
- [ ] No Kanban, o card e suas subdemandas são acessados na mesma drawer, sem empilhar drawers.
- [ ] É possível voltar da subdemanda à demanda mãe preservando o contexto.
- [ ] As visões de lista e Kanban internas do editor de calendário foram removidas; as telas de gestão de demandas continuam disponíveis.
- [ ] As permissões de copy são respeitadas em todas as entradas de navegação.

## Decisão consolidada

A Home combina **trabalho individual por função** com **um prazo global de entrega por ciclo**. A proposta de um prazo final diferente por calendário foi substituída pela regra compartilhada entre todos os designers. A navegação de demandas usa expansão na lista e detalhes na mesma drawer no Kanban, enquanto o editor de calendário mantém o planejamento mensal e o copy contextual.
