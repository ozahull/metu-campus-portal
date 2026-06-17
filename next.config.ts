import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Üst dizinde başka bir lockfile bulunduğu için Turbopack'in workspace
  // kökünü bu projeye sabitliyoruz.
  turbopack: {
    root: __dirname,
  },
};

export default withNextIntl(nextConfig);
