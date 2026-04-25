import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  allowedDevOrigins: ["100.111.25.122"],
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    globalNotFound: true,
    // lucide-react and react-icons/* are already optimised by default in
    // Next 16. motion ships across the dashboard header (mobile-drawer,
    // mega-menu, header-nav-item) so tree-shaking it cuts the shared
    // client bundle.
    optimizePackageImports: ["motion"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.discordapp.com" },
      { protocol: "https", hostname: "static-cdn.jtvnw.net" },
    ],
  },
};

export default nextConfig;
