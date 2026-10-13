import { spawnSync } from "node:child_process";
import { URL } from "node:url";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || process.env.ALLOW_DATABASE_TESTS !== "1") {
  console.error("Die lokale Schema-Installation erfordert TEST_DATABASE_URL und ALLOW_DATABASE_TESTS=1.");
  process.exit(1);
}

let parsedUrl;
try {
  parsedUrl = new URL(databaseUrl);
} catch {
  console.error("TEST_DATABASE_URL ist keine gültige PostgreSQL-URL.");
  process.exit(1);
}
if (
  !["localhost", "127.0.0.1", "::1"].includes(parsedUrl.hostname)
  || !["postgres:", "postgresql:"].includes(parsedUrl.protocol)
  || parsedUrl.search
) {
  console.error("Die Schema-Installation ist ausschließlich für eine lokale PostgreSQL-Datenbank erlaubt.");
  process.exit(1);
}

for (const file of ["supabase/base-schema.sql", "supabase/schema.sql"]) {
  const result = spawnSync(
    "psql",
    [databaseUrl, "--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--file", file],
    { encoding: "utf8" },
  );
  if (result.error) {
    console.error(`psql konnte nicht gestartet werden: ${result.error.message}`);
    process.exit(1);
  }
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    console.error(`Installation von ${file} fehlgeschlagen.`);
    process.exit(result.status ?? 1);
  }
}
