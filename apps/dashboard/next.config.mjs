import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@fluxy-chat/sdk", "@fluxy-chat/protocol", "@fluxy-chat/ui"],
  // Turbopack auto-detects the monorepo root by walking up for lockfiles.
  // A stray `C:\Users\alefare\package-lock.json` above the workspace makes it
  // pick the home directory as root, which forces it to scan the entire home
  // folder (OOM/crash). Pin the root to the pnpm workspace dir explicitly.
  // See https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack#root-directory
  turbopack: {
    root: path.resolve(__dirname, "../.."),
    resolveAlias: {},
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  // Security headers (CSP + X-Content-Type-Options + Referrer-Policy +
  // X-Frame-Options) are now set by the dashboard's middleware so each
  // request gets a unique nonce. Static headers here would conflict
  // with the per-request CSP. If you need to add a *static* header
  // (e.g. Strict-Transport-Security) add it here AND ensure the
  // middleware does not overwrite it.
};

export default nextConfig;
