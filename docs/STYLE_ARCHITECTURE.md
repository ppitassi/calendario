# Arquitetura de estilos

> A tela controla onde o componente fica; o componente controla como ele é.

Hierarquia: **token global → primitive reutilizável → componente único de feature → tela**.

- Use `src/styles/variables.css` para tokens semânticos.
- Use primitives em `src/components/ui` para padrões recorrentes.
- Use CSS Modules colocados junto ao TSX para estilos exclusivos.
- Use Tailwind para display, grid, flex, posicionamento, responsividade, dimensões externas e gap entre componentes.
- `className` em primitives serve apenas para composição externa. Não use cor, tipografia, padding, altura intrínseca, radius, shadow ou blur.
- Um componente de feature pode ter visual próprio, desde que reutilize tokens e não recrie um primitive existente. Ao surgir em mais de um domínio, deve ser promovido.
- `Select` usa HTML nativo por padrão. Use combobox customizado apenas para busca, multiseleção, conteúdo rico ou virtualização.

Exceções exigem comentário padronizado e justificativa no ponto de uso.

## Fronteira CSS × Tailwind

Tailwind controla display, flex, grid, posicionamento, overflow, alinhamento, responsividade, dimensões externas e gap entre componentes. Aparência, tipografia, estados e dimensões intrínsecas pertencem aos tokens e primitives.

Permitido: `<Button className="w-full md:w-auto" />`.

Proibido: `<Button className="h-9 rounded-lg bg-red-500 px-4 text-sm shadow-xl" />`.

`className` em primitives é exclusivamente um ponto de composição externa. O lint bloqueia utilities de aparência e dimensões internas tanto nas páginas quanto sobre primitives.

## Matriz de propriedade → responsável

| Propriedade | Responsável |
|---|---|
| Cor | Token global / Primitive |
| Fonte e escala tipográfica | Token / Typography / Primitive |
| Border e radius | Primitive / Surface |
| Shadow e blur | Primitive / Surface |
| Padding e altura internos | Primitive |
| Tamanho interno de ícones | Primitive |
| Gap entre componentes | Tailwind / CSS Module da tela |
| Grid e flex da página | Tailwind / CSS Module |
| Largura e altura externas | Tailwind / CSS Module |
| Breakpoints | Tailwind / CSS Module |
| Estilo exclusivo de feature | CSS Module local |
| Estado visual recorrente | Primitive |
| `z-index` | Tokens |
| Motion padrão | Tokens / Primitive |
| Regras de impressão | `print.css` |

## Regras formais

- Se existe um primitive equivalente, páginas não podem recriá-lo visualmente.
- HTML nativo interativo fora de primitives exige necessidade semântica, integração de navegador, impressão ou controle exclusivo de feature documentado no ponto de uso.
- Componentes únicos de feature podem usar CSS Module e Tailwind de layout, sempre com tokens globais e sem duplicar primitives.
- Um padrão usado em mais de um domínio deixa de ser exceção e deve ser promovido a componente compartilhado ou primitive.
- `styles/index.css` é o único agregador global. CSS de bibliotecas externas pode ser importado junto à integração responsável.
- Comentários aceitos: `style-architecture-exception: motivo`, `style-architecture-button-exception: motivo`, `style-architecture-utility-exception: motivo` e `style-token-exception: motivo`.

O catálogo executável dos primitives está disponível em `/ui-catalog` e é coberto por `npm run test:ui:browser`.
