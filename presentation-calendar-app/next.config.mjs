/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produz saída standalone apenas fora da Vercel (ex: PM2/Docker local).
  output: process.env.VERCEL ? undefined : "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  // pg usa módulos nativos/externos fora do bundle.
  serverExternalPackages: ["pg"],
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
