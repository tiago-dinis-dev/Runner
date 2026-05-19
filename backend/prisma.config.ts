import { config } from "dotenv";
import { resolve } from "path";
import { defineConfig, env } from "prisma/config";

// .env lives in the workspace root (parent of backend/)
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "../.env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
