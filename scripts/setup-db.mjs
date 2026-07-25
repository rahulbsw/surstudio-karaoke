import { databaseConfigured, ensureScoreSchema } from "../src/server/db.mjs";

if (!databaseConfigured) {
  console.error("DATABASE_URL is not configured.");
  process.exitCode = 1;
} else {
  await ensureScoreSchema();
  console.log("SurStudio hosted storage is ready.");
}
