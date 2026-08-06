import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer não deve ser empacotado pelo bundler (usa libs de Node).
  serverExternalPackages: ["@react-pdf/renderer"],
  async headers() {
    // App embutido como iframe no CRM: libera framing (frame-ancestors) e
    // não envia X-Frame-Options (que bloquearia o embed). Restringe o
    // frame-ancestors aos domínios do CRM quando definidos em
    // CRM_FRAME_ANCESTORS (lista separada por espaço); senão, mantém o padrão
    // aberto para não quebrar o embed atual.
    const ancestors = (process.env.CRM_FRAME_ANCESTORS ?? "").trim();
    const frameAncestors = ancestors ? `'self' ${ancestors}` : "'self' https:";
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${frameAncestors};`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
