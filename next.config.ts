import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Scaffold enxuto (2026-09-10). Sem Sentry/CSP por ora — adicionar
  // quando o projeto tiver dominio e trafego real.
  // root explicito: o repo fica aninhado dentro de outro (mega-brain).
  turbopack: { root: __dirname },
};

export default nextConfig;
