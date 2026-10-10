import { spawnSync } from "node:child_process";
import { URL } from "node:url";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) {
  console.error("TEST_DATABASE_URL fehlt. Es darf nur eine Wegwerf-Testdatenbank verwendet werden.");
  process.exit(1);
}
if (process.env.ALLOW_DATABASE_TESTS !== "1") {
  console.error("Setze ALLOW_DATABASE_TESTS=1, um den SQL-Test ausdrücklich freizugeben.");
  process.exit(1);
}

let parsedUrl;
try {
  parsedUrl = new URL(databaseUrl);
} catch {
  console.error("TEST_DATABASE_URL ist keine gültige PostgreSQL-URL.");
  process.exit(1);
}

if (!["localhost", "127.0.0.1", "::1"].includes(parsedUrl.hostname)) {
  console.error("SQL-Tests sind nur gegen eine lokale PostgreSQL-Testdatenbank erlaubt.");
  process.exit(1);
}
if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol) || parsedUrl.search) {
  console.error("TEST_DATABASE_URL darf nur PostgreSQL-Schema, Zugangsdaten, lokalen Host und Datenbank enthalten.");
  process.exit(1);
}

const result = spawnSync(
  "psql",
  [
    databaseUrl,
    "--no-psqlrc",
    "--set",
    "ON_ERROR_STOP=1",
    "--tuples-only",
    "--no-align",
    "--quiet",
    "--file",
    "supabase/tests/contribution_rules.test.sql",
  ],
  { encoding: "utf8" },
);

if (result.error) {
  console.error(`SQL-Tests konnten nicht gestartet werden: ${result.error.message}`);
  process.exit(1);
}
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.status !== 0) process.exit(result.status ?? 1);
if (result.stdout.split(/\r?\n/).some(line => line.startsWith("not ok ") || line.startsWith("Bail out!"))) {
  process.exit(1);
}
