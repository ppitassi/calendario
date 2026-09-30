/** Agrupa operações pequenas e puras usadas por mais de um componente. */

/** Descarta valores falsos e une as classes CSS restantes com um espaço. */
export function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(" ");
}
