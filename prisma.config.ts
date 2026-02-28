import { config } from "dotenv";
import { expand } from "dotenv-expand";
import { defineConfig, env } from "prisma/config";

// Load .env.local first (Next.js convention), then .env as fallback
expand(config({ path: ".env.local" }));
expand(config());

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
