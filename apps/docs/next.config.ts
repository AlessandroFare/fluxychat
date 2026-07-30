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
};

const withMDX = createMDX();

export default withMDX(config);
