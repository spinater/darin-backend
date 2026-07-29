import type { NextConfig } from "next";
export default {
  output: "standalone",
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
} satisfies NextConfig;
