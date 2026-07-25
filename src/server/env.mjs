import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const candidates = [
  process.env.SURSTUDIO_ENV_PATH,
  resolve(process.cwd(), ".env"),
  process.env.SURSTUDIO_APP_ROOT ? resolve(process.env.SURSTUDIO_APP_ROOT, ".env") : "",
].filter(Boolean);

const envPath = candidates.find(existsSync);

if (envPath) {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envPath);
  } else {
    readFileSync(envPath, "utf8").split(/\r?\n/).forEach((line) => {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]] != null) return;
      let value = match[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[match[1]] = value;
    });
  }
}
