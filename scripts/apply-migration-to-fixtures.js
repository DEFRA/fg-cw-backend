#!/usr/bin/env node
/**
 * Applies a migration file's DB operations to the corresponding workflow
 * definition fixtures in test/fixtures/.
 *
 * Usage: node scripts/apply-migration-to-fixtures.js <path-to-migration>
 *
 * It mocks MongoDB's db object to intercept updateOne calls, extracts the code from
 * each filter to find the matching fixture file ({code}-workflow-definition.json),
 * then applies $set (and $unset) operations using dot-notation path traversal.
 *
 * It warns on unknown collection names, missing fixtures, or unsupported operators.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const fixturesDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../test/fixtures",
);

function setByPath(obj, dotPath, value) {
  const parts = dotPath.split(".");
  let node = obj;
  for (const part of parts.slice(0, -1)) {
    node = node[isNaN(part) ? part : Number(part)];
  }
  const last = parts.at(-1);
  node[isNaN(last) ? last : Number(last)] = value;
}

function unsetByPath(obj, dotPath) {
  const parts = dotPath.split(".");
  let node = obj;
  for (const part of parts.slice(0, -1)) {
    node = node[isNaN(part) ? part : Number(part)];
  }
  const last = parts.at(-1);
  if (Array.isArray(node)) {
    node.splice(Number(last), 1);
  } else {
    delete node[last];
  }
}

const migrationPath = process.argv[2];
if (!migrationPath) {
  console.error(
    "Usage: node scripts/apply-migration-to-fixtures.js <migration-file>",
  );
  process.exit(1);
}

const captured = [];

const mockDb = {
  collection: (name) => ({
    updateOne: (filter, update) => {
      captured.push({ collection: name, filter, update });
      return Promise.resolve({ acknowledged: true });
    },
    updateMany: (filter, update) => {
      captured.push({ collection: name, filter, update, many: true });
      return Promise.resolve({ acknowledged: true });
    },
  }),
};

const { up } = await import(resolve(process.cwd(), migrationPath));
await up(mockDb);

let changed = 0;

for (const { collection, filter, update } of captured) {
  if (collection !== "workflows") {
    console.warn(`Skipping unsupported collection: ${collection}`);
    continue;
  }

  const code = filter.code;
  if (!code) {
    console.warn("Skipping updateOne with no code filter:", filter);
    continue;
  }

  const fixturePath = resolve(fixturesDir, `${code}-workflow-definition.json`);
  let fixture;
  try {
    fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  } catch {
    console.warn(
      `No fixture found for workflow "${code}" — expected: ${fixturePath}`,
    );
    continue;
  }

  if (update.$set) {
    for (const [path, value] of Object.entries(update.$set)) {
      setByPath(fixture, path, value);
    }
  }

  if (update.$unset) {
    for (const path of Object.keys(update.$unset)) {
      unsetByPath(fixture, path);
    }
  }

  const unsupported = Object.keys(update).filter(
    (k) => !["$set", "$unset"].includes(k),
  );
  if (unsupported.length) {
    console.warn(
      `Unsupported operators for "${code}" (applied $set/$unset only): ${unsupported.join(", ")}`,
    );
  }

  writeFileSync(fixturePath, JSON.stringify(fixture, null, 2) + "\n");
  console.log(`Updated ${fixturePath}`);
  changed++;
}

console.log(`\nDone — ${changed} fixture(s) updated.`);
