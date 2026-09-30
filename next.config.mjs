/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produz o servidor mínimo iniciado pelo PM2, sem depender de `next start`.
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  // SQLite e pg usam módulos nativos/externos fora do bundle.
  serverExternalPackages: ["pg", "node:sqlite"],
  // Estado local jamais pode entrar no trace nem no bundle enviado ao servidor.
  outputFileTracingExcludes: {
    "/*": [
      "./data/**/*",
      "./public/uploads/**/*",
      "./logs/**/*",
      "./artifacts/**/*",
    ],
  },
  // Garante que o Turbopack trate este subdiretório como projeto independente.
  turbopack: { root: process.cwd() },

  /** Adiciona proteções básicas também às respostas dos Route Handlers. */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
