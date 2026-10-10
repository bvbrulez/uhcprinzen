import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = resolve(fileURLToPath(new URL("../../src/", import.meta.url)));
const port = Number(process.env.E2E_PORT || 4173);
const supabaseUrl = process.env.E2E_SUPABASE_URL || "http://127.0.0.1:54321";
const supabaseAnonKey = process.env.E2E_SUPABASE_ANON_KEY || "";

let configuredSupabaseUrl;
try {
  configuredSupabaseUrl = new URL(supabaseUrl);
} catch {
  throw new Error("E2E_SUPABASE_URL muss eine gültige URL sein.");
}

if (
  configuredSupabaseUrl.protocol !== "http:"
  || !["localhost", "127.0.0.1", "[::1]"].includes(configuredSupabaseUrl.hostname)
) {
  throw new Error("E2E darf nur mit einer lokalen Supabase-Instanz ausgeführt werden.");
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
};

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, `http://127.0.0.1:${port}`).pathname;
  if (pathname === "/supabase-config.js") {
    response.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
    response.end(`window.SUPABASE_CONFIG = ${JSON.stringify({
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
    })};`);
    return;
  }

  let requestedPath;
  try {
    requestedPath = decodeURIComponent(pathname);
  } catch {
    response.writeHead(400).end("Invalid path");
    return;
  }
  const filePath = resolve(sourceRoot, `.${requestedPath === "/" ? "/index.html" : requestedPath}`);
  if (filePath !== sourceRoot && !filePath.startsWith(`${sourceRoot}${sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const content = await readFile(filePath);
    response.writeHead(200, {
      "content-type": contentTypes[extname(filePath)] || "application/octet-stream",
    });
    response.end(content);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

server.listen(port, "127.0.0.1");
