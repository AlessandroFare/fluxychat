import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

const config: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["shiki"],
  turbopack: {
    root: rootDir,
  },
  async redirects() {
    return [
      {
        source: "/docs/learn/for-analysts",
        destination: "/docs/learn/status-and-limits",
        permanent: true,
      },
      {
        source: "/errors",
        destination: "/docs/errors",
        permanent: false,
      },
      {
        source: "/errors/:slug",
        destination: "/docs/errors/:slug",
        permanent: false,
      },
    ];
  },
};

const withMDX = createMDX();

export default withMDX(config);
