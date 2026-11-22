const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const MANIFEST_PATH = path.join(ROOT, "manifest.json");

const EXPECTED_PERMISSIONS = [
  "tabs",
  "tabGroups",
  "sessions",
  "bookmarks",
  "history",
  "storage",
  "scripting",
  "activeTab",
  "downloads"
];

const EXPECTED_OPTIONAL_PERMISSIONS = ["management"];

function readManifest() {
  const raw = fs.readFileSync(MANIFEST_PATH, "utf8");
  return JSON.parse(raw);
}

function assertNonEmptyFile(relPath, context) {
  assert.equal(typeof relPath, "string", `${context}: file path must be a string`);
  assert.ok(relPath.length > 0, `${context}: file path must not be empty`);
  const fullPath = path.join(ROOT, relPath);
  assert.ok(fs.existsSync(fullPath), `${context}: missing file ${relPath}`);
  const stat = fs.statSync(fullPath);
  assert.ok(stat.isFile(), `${context}: expected ${relPath} to be a regular file`);
  assert.ok(stat.size > 0, `${context}: file ${relPath} must not be empty`);
}

function extractScriptSrcs(html) {
  const srcs = [];
  const regex = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    srcs.push(match[1]);
  }
  return srcs;
}

function extractStylesheetHrefs(html) {
  const hrefs = [];
  const regex = /<link\b[^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const tag = match[0];
    if (!/\brel\s*=\s*["']stylesheet["']/i.test(tag)) continue;
    const hrefMatch = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag);
    if (hrefMatch) {
      hrefs.push(hrefMatch[1]);
    }
  }
  return hrefs;
}

test("manifest.json has valid MV3 metadata and semver version", () => {
  const manifest = readManifest();

  assert.equal(manifest.manifest_version, 3, "manifest_version must be 3");
  assert.equal(typeof manifest.name, "string", "name must be a string");
  assert.ok(manifest.name.trim().length > 0, "name must be non-empty");
  assert.equal(typeof manifest.description, "string", "description must be a string");
  assert.ok(manifest.description.trim().length > 0, "description must be non-empty");
  assert.equal(typeof manifest.version, "string", "version must be a string");
  assert.match(
    manifest.version,
    /^\d+\.\d+\.\d+$/,
    `version "${manifest.version}" must match semver ^\\d+\\.\\d+\\.\\d+$`
  );
});

test("manifest.json referenced extension entry files exist on disk and are non-empty", () => {
  const manifest = readManifest();

  assertNonEmptyFile(manifest.background?.service_worker, "background.service_worker");
  assertNonEmptyFile(manifest.action?.default_popup, "action.default_popup");
  assertNonEmptyFile(manifest.options_page, "options_page");

  // No always-on content script: the palette is injected on demand via
  // chrome.scripting + activeTab (see background.js command handler), so the
  // manifest must not declare content_scripts or host_permissions.
  assert.equal(
    manifest.content_scripts,
    undefined,
    "content_scripts must be absent: no always-on content script"
  );
  assert.equal(
    manifest.host_permissions,
    undefined,
    "host_permissions must be absent: no broad host permission"
  );
  assertNonEmptyFile("content.js", "content.js (injected on demand by background.js)");

  assert.ok(
    Array.isArray(manifest.web_accessible_resources) && manifest.web_accessible_resources.length > 0,
    "web_accessible_resources must be a non-empty array"
  );
  for (const [idx, entry] of manifest.web_accessible_resources.entries()) {
    assert.ok(
      Array.isArray(entry.resources) && entry.resources.length > 0,
      `web_accessible_resources[${idx}].resources must be a non-empty array`
    );
    for (const file of entry.resources) {
      assertNonEmptyFile(file, `web_accessible_resources[${idx}].resources`);
    }
  }
});

test("HTML entry pages load existing non-empty scripts and stylesheets", () => {
  const htmlPages = ["palette-frame.html", "popup.html", "options.html"];

  for (const page of htmlPages) {
    assertNonEmptyFile(page, "HTML entry page");
    const html = fs.readFileSync(path.join(ROOT, page), "utf8");
    const scripts = extractScriptSrcs(html);
    assert.ok(scripts.length > 0, `${page} must reference at least one script`);

    for (const src of scripts) {
      assert.ok(!/^https?:\/\//i.test(src), `${page} must not load remote script ${src}`);
      assertNonEmptyFile(src, `${page} <script>`);
    }

    for (const href of extractStylesheetHrefs(html)) {
      assert.ok(!/^https?:\/\//i.test(href), `${page} must not load remote stylesheet ${href}`);
      assertNonEmptyFile(href, `${page} <link rel="stylesheet">`);
    }
  }
});

test("manifest.json permissions and optional_permissions match minimal expected sets", () => {
  const manifest = readManifest();

  assert.ok(Array.isArray(manifest.permissions), "permissions must be an array");
  assert.ok(Array.isArray(manifest.optional_permissions), "optional_permissions must be an array");

  const actualPerms = [...manifest.permissions].sort();
  const expectedPerms = [...EXPECTED_PERMISSIONS].sort();
  assert.deepEqual(
    actualPerms,
    expectedPerms,
    "manifest.json permissions must match the minimal expected permission set"
  );

  const actualOptional = [...manifest.optional_permissions].sort();
  const expectedOptional = [...EXPECTED_OPTIONAL_PERMISSIONS].sort();
  assert.deepEqual(
    actualOptional,
    expectedOptional,
    "manifest.json optional_permissions must match the minimal expected optional permission set"
  );
});
