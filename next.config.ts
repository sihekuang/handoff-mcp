import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@electric-sql/pglite"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
