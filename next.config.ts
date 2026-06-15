import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Üst dizinde başka bir lockfile bulunduğu için Turbopack'in workspace
  // kökünü bu projeye sabitliyoruz.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
