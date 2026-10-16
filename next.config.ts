import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  serverExternalPackages: ["pdfkit"],
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...(config.watchOptions ?? {}),
        ignored: ["**/tools/**", "**/data/cache/**", "**/node_modules/**"],
      };
    }
    return config;
  },
};

export default nextConfig;
