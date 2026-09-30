/** Define o documento raiz, os metadados e os estilos usados por todas as rotas. */

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Presentation Studio",
  description: "Calendário editorial e apresentações de conteúdo.",
};

/** Envolve cada página em um documento identificado como português do Brasil. */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
