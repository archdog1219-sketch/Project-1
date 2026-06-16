import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Neon serverless driver and Prisma's Neon adapter use Node.js-native
  // features (WebSockets); bundling them breaks the DB connection at runtime.
  // Opt them out of Server Component bundling so they run via native require.
  serverExternalPackages: ["@prisma/adapter-neon", "@neondatabase/serverless"],
};

export default nextConfig;
