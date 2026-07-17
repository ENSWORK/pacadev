import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    "pacadev.local",
    "web.pacadev.local",
    "192.168.11.121",
    "preview-chat-47384992-5212-4375-b486-d9904310f434.space-z.ai",
  ],
};

export default nextConfig;
