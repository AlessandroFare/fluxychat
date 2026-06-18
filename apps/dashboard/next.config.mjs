/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@fluxy-chat/sdk", "@fluxychat/protocol", "@fluxychat/ui"],
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
