/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@fluxy-chat/sdk", "@fluxychat/protocol", "@fluxychat/ui"],
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
