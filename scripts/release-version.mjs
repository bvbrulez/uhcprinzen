import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function parseVersion(version) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
  if (!match) throw new Error(`Invalid semantic version: ${version}`);
  return match.slice(1).map(Number);
}

export function classifyVersionBump(messages) {
  let bump = "patch";
  for (const message of messages) {
    const [subject, ...bodyLines] = message.split(/\r?\n/);
    if (
      /^[a-z]+(?:\([^)]*\))?!:/.test(subject)
      || bodyLines.some(line => /^BREAKING[ -]CHANGE:\s*\S/.test(line))
    ) {
      return "major";
    }
    if (/^feat(?:\([^)]*\))?:/.test(subject)) bump = "minor";
  }
  return bump;
}

export function incrementVersion(version, bump) {
  const [major, minor, patch] = parseVersion(version);
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  if (bump === "patch") return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Unknown version bump: ${bump}`);
}

export function addVersionChangelogEntry(changelog, date, version, messages) {
  const releaseEntry = [
    `### Version ${version}`,
    "",
    ...messages.map(message => `- ${message.split(/\r?\n/, 1)[0].trim()}`),
    "",
    "",
  ].join("\n");
  const dateHeading = new RegExp(`^## ${date.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m");
  const match = dateHeading.exec(changelog);
  if (match) {
    const insertAt = match.index + match[0].length;
    const before = changelog.slice(0, insertAt);
    const after = changelog.slice(insertAt).replace(/^\n*/, "");
    return `${before}\n\n${releaseEntry}${after}`;
  }

  const firstDateHeading = /^## \d{4}-\d{2}-\d{2}$/m.exec(changelog);
  if (firstDateHeading) {
    const insertAt = firstDateHeading.index;
    return `${changelog.slice(0, insertAt)}## ${date}\n\n${releaseEntry}${changelog.slice(insertAt)}`;
  }
  return `${changelog.trimEnd()}\n\n## ${date}\n\n${releaseEntry}`;
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

async function main() {
  const before = process.env.PUSH_BEFORE_SHA;
  const after = process.env.PUSH_AFTER_SHA;
  if (!/^[0-9a-f]{40}$/i.test(after || "")) throw new Error("PUSH_AFTER_SHA must be a full commit SHA.");

  let range;
  if (/^0+$/.test(before || "")) {
    range = [after];
  } else {
    if (!/^[0-9a-f]{40}$/i.test(before || "")) throw new Error("PUSH_BEFORE_SHA must be a full commit SHA.");
    range = git("rev-list", "--reverse", `${before}..${after}`).split("\n").filter(Boolean);
  }
  if (!range.length) throw new Error("The push did not contain any commits to release.");

  const messages = range.map(commit => git("show", "-s", "--format=%B", commit));
  const version = (await readFile("VERSION", "utf8")).trim();
  const nextVersion = incrementVersion(version, classifyVersionBump(messages));
  const date = new Date().toISOString().slice(0, 10);
  const changelog = await readFile("CHANGELOG.md", "utf8");
  const index = await readFile("src/index.html", "utf8");
  const versionMarkup = /(<span id="app-version">)v\d+\.\d+\.\d+(<\/span>)/;
  if (!versionMarkup.test(index)) throw new Error("Could not find the footer app-version marker in src/index.html.");

  await writeFile("VERSION", `${nextVersion}\n`);
  await writeFile("src/index.html", index.replace(versionMarkup, `$1v${nextVersion}$2`));
  await writeFile("CHANGELOG.md", addVersionChangelogEntry(changelog, date, nextVersion, messages));
  console.log(`version=${nextVersion}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
