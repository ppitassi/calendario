# Planejamento de Analytics e Performance

## Objetivo

Transformar o painel atual em uma ferramenta de análise acionável, conectando planejamento, produção e resultado sem exibir métricas simuladas, indisponíveis ou pertencentes a integrações inativas.

## Princípios

- Mostrar somente integrações ativas e dados reais.
- Diferenciar `0`, dado indisponível e dado ainda não sincronizado.
- Aplicar todos os filtros na consulta do servidor.
- Separar métricas do período de métricas acumuladas do post.
- Comparar conteúdos equivalentes: cliente, canal, formato, objetivo e etapa do funil.
- Usar mediana e percentis para reduzir a distorção causada por posts virais.
- Expor a fórmula e o nível de confiança de qualquer score interno.
- Manter tenant, autorização e credenciais validados no servidor.

## Fase 1 — Fundação histórica

**Status:** base implementada em 20/07/2026; enriquecimento progressivo dos snapshots pendente.

### Dados

- Criar snapshots diários por perfil e integração.
- Criar snapshots por conteúdo para acompanhar sua evolução.
- Registrar execuções, erros, duração e próxima sincronização.
- Preservar respostas brutas separadas dos dados normalizados.
- Guardar valores ausentes como `null`, nunca como zero.

### Entidades sugeridas

- `profile_metric_snapshots`
- `content_metric_snapshots`
- `audience_demographic_snapshots`
- `analytics_sync_runs`
- `performance_targets`
- `content_tags`
- `campaigns`
- `competitor_snapshots` — fase posterior

### Frequência

- Perfil: uma vez ao dia.
- Conteúdo recente: 1h, 6h, 24h, 3d, 7d e 30d após publicação.
- Conteúdo antigo: diária ou semanalmente.
- Concorrentes: diariamente, quando implementado.

### Critérios de conclusão

- Histórico permanece após reinício e nova sincronização.
- Sincronização duplicada é idempotente.
- Falhas parciais não apagam dados válidos anteriores.
- A interface informa última sincronização, estado e erro seguro.

## Fase 2 — Filtros e comparação

**Status:** filtros globais de período, plataforma e formato, consultas no servidor e comparação com período anterior implementados em 20/07/2026.

### Filtros globais

- Período e período comparativo.
- Integração/canal.
- Perfil.
- Formato: feed, carrossel, Reel, Story e vídeo.
- Campanha e tags.
- Pilar editorial.
- Objetivo.
- Etapa do funil.
- Autor/responsável.
- Orgânico ou pago.

### Comparações

- Período anterior equivalente.
- Intervalo personalizado.
- Meta definida pelo cliente.
- Mediana móvel de 90 dias.
- Conteúdos do mesmo formato e objetivo.

### Critérios de conclusão

- Todo filtro altera a consulta no servidor e a URL do painel.
- KPIs, gráficos e tabelas usam exatamente o mesmo escopo.
- O painel deixa explícito quando compara métricas de período ou lifetime.

## Fase 3 — Visão executiva

**Status:** overview compacto com seis KPIs, variação contra o período anterior e sparklines implementado em 20/07/2026; metas configuráveis seguem pendentes.

### KPIs

- Seguidores atuais.
- Crescimento líquido e percentual.
- Alcance.
- Visualizações.
- Interações totais.
- Taxa de engajamento por alcance.
- Visitas ao perfil.
- Cliques no link.
- Conteúdos publicados.
- Progresso contra a meta mensal.

Cada KPI deve conter valor, variação absoluta, variação percentual, meta, tendência e explicação curta.

### Visualizações

- Cards compactos com sparklines.
- Linha temporal diária ou semanal.
- Anotações de campanhas e publicações relevantes.
- Resumo automático da LeIA baseado somente nos dados filtrados.

## Fase 4 — Performance de conteúdo

**Status:** ranking com dados válidos, engajamento incluindo salvamentos, taxas de save/share, mediana por formato, quadrantes e Pareto implementados em 20/07/2026.

### Métricas por publicação

- Alcance e visualizações.
- Likes, comentários, compartilhamentos e salvamentos.
- Interações totais.
- Engajamento por alcance.
- Compartilhamentos por alcance.
- Salvamentos por alcance.
- Visualizações por seguidor.
- Evolução nas primeiras 24 horas.
- Resultado contra a mediana do perfil.
- Resultado contra conteúdos equivalentes.

### Visualizações

- Ranking completo em tabela com sparklines.
- Barras por formato, pilar, objetivo e etapa do funil.
- Scatter plot de alcance × engajamento.
- Quadrantes de performance.
- Pareto dos conteúdos responsáveis pela maior parte do resultado.
- Distribuição por formato usando mediana e percentis.

## Fase 5 — Estratégia e funil

**Status:** análise por funil e objetivo, cobertura de classificação e vínculo automático com o planejamento pela publicação ou data implementados em 20/07/2026.

### Topo de funil

- Alcance.
- Visualizações.
- Compartilhamentos.
- Descoberta por não seguidores, quando disponível.

### Meio de funil

- Salvamentos.
- Comentários.
- Visitas ao perfil.
- Interações qualificadas.

### Fundo de funil

- Cliques.
- Mensagens.
- Leads.
- Conversões, quando houver fonte externa.

### Análises

- Resultado por objetivo, etapa, pilar, campanha e formato.
- Distribuição do volume produzido por etapa do funil.
- Resultado alcançado versus esforço de produção.
- Identificação de lacunas do planejamento.

## Fase 6 — LeIA Performance Score

**Status:** score por percentis, formato, objetivo, engajamento qualificado e momentum, com confiança e fórmula visível, implementado em 20/07/2026.

Score de 0 a 100, calculado contra conteúdos comparáveis dos últimos 90 dias.

### Composição inicial

- 30%: alcance relativo.
- 25%: engajamento qualificado.
- 20%: retenção de vídeo, quando aplicável.
- 15%: resultado ligado ao objetivo.
- 10%: velocidade inicial.

### Faixas

- 85–100: excepcional.
- 70–84: acima da média.
- 40–69: dentro do esperado.
- 20–39: abaixo da média.
- 0–19: crítico.

### Indicadores complementares

- `Confidence`: qualidade e volume da amostra.
- `Momentum`: velocidade de crescimento.
- `Evergreen`: continuidade do resultado ao longo do tempo.
- `Efficiency`: resultado em relação ao custo ou esforço.
- `Quality Engagement`: peso maior para salvamentos e compartilhamentos.

### Regras

- Fórmula e componentes visíveis ao usuário.
- Score indisponível quando a amostra não for suficiente.
- Pesos configuráveis por objetivo e tenant futuramente.

## Fase 7 — Vídeo e Reels

**Status:** métricas reais de vídeo/Reels e curva de maturação por snapshots implementadas em 20/07/2026; campos não retornados pela Meta permanecem ocultos.

- Views e alcance.
- Tempo médio e total assistido.
- Retenção e conclusão.
- Skip rate inicial, quando disponível.
- Replays.
- Compartilhamentos por view.
- Seguidores obtidos.
- Curva de evolução em 1h, 6h, 24h, 3d, 7d e 30d.

Não renderizar métricas que a integração não disponibilizar.

## Fase 8 — Horários e cadência

**Status:** heatmap real, recomendações com amostra mínima, filtros por canal/formato e cadência planejado versus publicado implementados em 20/07/2026.

- Heatmap por dia da semana e hora.
- Calendário de frequência de publicação.
- Consistência contra o planejamento.
- Melhor horário por alcance, interação ou objetivo.
- Separação por formato e canal.
- Amostra mínima antes de gerar recomendações.

## Fase 9 — Benchmark

**Status:** benchmark interno entre clientes, score relativo, crescimento, frequência, interações, alcance e mix de formatos implementados em 20/07/2026. Concorrentes externos permanecem pendentes de uma fonte pública autorizada.

### Entre clientes da agência

- Crescimento percentual.
- Frequência.
- Engajamentos por post.
- Mix de formatos.
- Mediana de performance.
- Posição por cluster ou segmento.

### Concorrentes

- Crescimento público.
- Frequência de postagem.
- Interações públicas por post.
- Mix de formatos.
- Top posts.
- Share of engagement.

Marcar claramente métricas públicas estimadas e iniciar o histórico somente a partir da ativação do monitoramento.

## Fase 10 — Relatórios e alertas

**Status:** relatório executivo filtrado, PDF one-page sem controles, alertas factuais e resumo da LeIA com ações sugeridas implementados em 20/07/2026. Templates e envio recorrente permanecem pendentes.

- One-page interativo por cliente.
- PDF sem controles interativos.
- Templates configuráveis.
- Comentários e explicações editoriais.
- Envio recorrente.
- Alertas de queda, crescimento anormal, meta em risco e post excepcional.
- Resumos da LeIA com fatos, causas prováveis e ações sugeridas.

## Biblioteca de gráficos

- Linha e área: evolução temporal.
- Barras agrupadas: comparação entre categorias.
- Barras empilhadas: composição de resultados.
- Scatter/bubble: correlação e quadrantes.
- Heatmap: horários e cadência.
- Pareto: concentração de resultado.
- Funil: avanço entre objetivos.
- Waterfall: composição de variações.
- Box plot: distribuição e outliers.
- Tabela com sparklines: análise operacional detalhada.
- Curva de maturação: velocidade do conteúdo.

Evitar gráficos de radar como visual principal e gráficos de pizza com muitas categorias.

## Ordem econômica de implementação

1. Snapshots históricos e sincronização idempotente.
2. Filtros reais e comparação entre períodos.
3. Overview compacto com tendências.
4. Ranking e detalhamento de posts.
5. Análise por formato, objetivo, funil e pilar.
6. Scatter plot, heatmap e Pareto.
7. LeIA Performance Score.
8. Curva de maturação de conteúdo.
9. Metas e alertas.
10. Benchmark, mídia paga, tráfego e conversões.

## Definição de pronto geral

- Nenhuma métrica simulada no ambiente de produção.
- Nenhum componente vazio fingindo possuir dados.
- Todos os números possuem origem e definição consultáveis.
- Período, timezone e método de cálculo são consistentes.
- Exportação reproduz o mesmo estado filtrado da tela.
- Consultas respeitam tenant e permissões no servidor.
- Testes cobrem cálculos, filtros, isolamento de tenant e ausência de dados.
