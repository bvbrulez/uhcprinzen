import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  addVersionChangelogEntry,
  classifyVersionBump,
  incrementVersion,
  parseVersion,
} from "../../scripts/release-version.mjs";

test("parses strict semantic versions", () => {
  assert.deepEqual(parseVersion("1.2.3"), [1, 2, 3]);
  assert.throws(() => parseVersion("01.2.3"), /Invalid semantic version/);
  assert.throws(() => parseVersion("1.2"), /Invalid semantic version/);
});

test("classifies conventional commit batches by the highest SemVer impact", () => {
  assert.equal(classifyVersionBump(["fix: correct a label", "docs: update instructions"]), "patch");
  assert.equal(classifyVersionBump(["feat(ui): add monthly close", "fix: typo"]), "minor");
  assert.equal(classifyVersionBump(["feat!: replace the auth contract"]), "major");
  assert.equal(classifyVersionBump(["fix: update endpoint\n\nBREAKING CHANGE: old clients no longer work"]), "major");
  assert.equal(classifyVersionBump(["chore: update release metadata"]), "patch");
});

test("increments major, minor, and patch versions following SemVer precedence", () => {
  assert.equal(incrementVersion("1.2.3", "patch"), "1.2.4");
  assert.equal(incrementVersion("1.2.3", "minor"), "1.3.0");
  assert.equal(incrementVersion("1.2.3", "major"), "2.0.0");
});

test("adds a dated release section to an existing or new changelog date", () => {
  const existing = "# Changelog\n\n## 2026-10-13\n\n### Earlier entry\n\n- Existing\n\n## 2026-10-11\n\n- Older";
  const updated = addVersionChangelogEntry(existing, "2026-10-13", "1.1.0", ["feat: add receipt support\n\nDetails"]);
  assert.match(updated, /## 2026-10-13\n\n### Version 1\.1\.0\n\n- feat: add receipt support\n\n### Earlier entry/);
  assert.match(
    addVersionChangelogEntry("# Changelog\n\nIntro", "2026-10-13", "1.0.1", ["fix: correct a typo"]),
    /## 2026-10-13\n\n### Version 1\.0\.1\n\n- fix: correct a typo/,
  );
});

test("release script updates VERSION, footer, and changelog for pushed commits", async () => {
  const directory = await mkdtemp(join(tmpdir(), "uhcprinzen-release-test-"));
  const git = (...args) => execFileSync("git", args, { cwd: directory, encoding: "utf8" }).trim();
  try {
    await mkdir(join(directory, "src"), { recursive: true });
    await mkdir(join(directory, "scripts"), { recursive: true });
    await writeFile(join(directory, "VERSION"), "1.0.0\n");
    await writeFile(join(directory, "src/index.html"), '<span id="app-version">v1.0.0</span>\n');
    await writeFile(join(directory, "CHANGELOG.md"), "# Changelog\n\nIntro\n");
    git("init", "-q");
    git("config", "user.name", "Release test");
    git("config", "user.email", "release-test@example.test");
    git("add", ".");
    git("commit", "-m", "chore: initialize test fixture", "-q");
    const before = git("rev-parse", "HEAD");
    await writeFile(join(directory, "feature.txt"), "feature\n");
    git("add", "feature.txt");
    git("commit", "-m", "feat: add a feature", "-q");
    const after = git("rev-parse", "HEAD");

    const result = spawnSync("node", [resolve("scripts/release-version.mjs")], {
      cwd: directory,
      encoding: "utf8",
      env: { ...process.env, PUSH_BEFORE_SHA: before, PUSH_AFTER_SHA: after },
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /version=1\.1\.0/);
    assert.equal(await readFile(join(directory, "VERSION"), "utf8"), "1.1.0\n");
    assert.equal(await readFile(join(directory, "src/index.html"), "utf8"), '<span id="app-version">v1.1.0</span>\n');
    assert.match(await readFile(join(directory, "CHANGELOG.md"), "utf8"), /### Version 1\.1\.0\n\n- feat: add a feature/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
