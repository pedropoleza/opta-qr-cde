import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer não deve ser empacotado pelo bundler (usa libs de Node).
  serverExternalPackages: ["@react-pdf/renderer"],
  async headers() {
    // App embutido como iframe no CRM: libera framing (frame-ancestors) e
    // não envia X-Frame-Options (que bloquearia o embed). Restringir o
    // frame-ancestors ao domínio do CRM quando ele estiver definido.
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' https:;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
