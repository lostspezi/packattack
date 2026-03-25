import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["100.111.25.122"],
  experimental: {
    globalNotFound: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.discordapp.com" },
      { protocol: "https", hostname: "static-cdn.jtvnw.net" },
    ],
  },
};

export default nextConfig;
