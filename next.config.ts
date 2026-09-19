import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/suitor-protocol",
  trailingSlash: true,
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: { root: process.cwd() },
};

export default nextConfig;
