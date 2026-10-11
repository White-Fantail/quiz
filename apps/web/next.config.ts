import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@quizdip/domain", "@quizdip/i18n"],
};

export default nextConfig;
