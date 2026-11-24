import { BSON, Collection, Db } from "mongodb";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { presentHashes } from "../../../scripts/shared-explore.js";
import { READS, readOnly } from "../../common/explore/read-only.js";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const VIEW = "common/explore/read-only.js";
const ENGINE = "common/buckets/engine.js";
const MONGO_CLIENT = "common/mongo-client.js";
const AUDIT = "common/audited-read.js";

// The service files that register Explore's routes and sources.
const REGISTERING = ["actuators/index.js", "cases/index.js"];

const methodsOf = (prototype) =>
  Object.getOwnPropertyNames(prototype).filter(
    (name) =>
      name !== "constructor" &&
      typeof Object.getOwnPropertyDescriptor(prototype, name).value ===
        "function",
  );

// The driver's collection and database methods that only read, or hand out
// something that does. Any other it has, or gains, is taken to write.
const DRIVER_READS = [
  "find",
  "findOne",
  "aggregate",
  "countDocuments",
  "distinct",
  "estimatedDocumentCount",
  "count",
  "options",
  "isCapped",
  "listIndexes",
  "indexExists",
  "indexInformation",
  "indexes",
  "listSearchIndexes",
  "watch",
  "admin",
  "collection",
  "collections",
  "listCollections",
  "stats",
  "profilingLevel",
];

const COLLECTION_METHODS = methodsOf(Collection.prototype);

const WRITES = [
  ...new Set([...COLLECTION_METHODS, ...methodsOf(Db.prototype)]),
].filter((name) => !DRIVER_READS.includes(name));

// The engine's pure exports, which read no collection.
const ENGINE_HELPERS = [
  "COUNT_CAP",
  "MAX_TIME_MS_EXPIRED",
  "SECONDARY",
  "and",
  "findOptions",
  "keysetParts",
  "matchParts",
  "readTimeoutMs",
  "residualPart",
  "timeLeft",
  "widthsOf",
  "withinEdge",
];

const textOf = (path) => readFileSync(join(SRC, path), "utf8");

const isScanned = (path) =>
  path.endsWith(".js") &&
  !path.endsWith(".test.js") &&
  !path.split("/").at(-1).startsWith("test-");

const isExplore = (path) => /explore/.test(path) && isScanned(path);

const exploreFiles = readdirSync(SRC, { recursive: true })
  .map((path) => path.split("\\").join("/"))
  .filter(isExplore);

const sharedFiles = [...presentHashes().keys()]
  .map((path) => `common/${path}`)
  .filter(isScanned);

const bucketsFiles = sharedFiles.filter((path) => !isExplore(path));

// Tests seed and spy on collections, so only what runs is scanned.
const scanned = [...new Set([...exploreFiles, ...sharedFiles])];

const IMPORT =
  /\b(?:import|export)\s+(?:([^;"]*?)\s+from\s+)?"([^"]+)"|\bimport\s*\(|\brequire\s*\(/g;

const importsOf = (path) =>
  [...textOf(path).matchAll(IMPORT)].map(([statement, clause, from]) => ({
    statement,
    clause: clause ?? "",
    from: from?.startsWith(".")
      ? relative(SRC, resolve(dirname(join(SRC, path)), from))
      : from,
  }));

const namesOf = (clause) => {
  const listed = clause.match(/\{([^}]*)\}/)?.[1] ?? "";
  const named = listed
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [imported, local = imported] = item.split(/\s+as\s+/);

      return { imported, local };
    });
  const outer = clause.replace(/\{[^}]*\}/, "").trim();
  const others = outer
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) =>
      item.startsWith("*")
        ? { imported: "*", local: item.split(/\s+as\s+/)[1] }
        : { imported: "default", local: item },
    );

  return [...named, ...others];
};

// The text inside the brackets that open at `at`.
const bracketedFrom = (text, at) => {
  let depth = 0;

  for (let end = at; end < text.length; end++) {
    depth += { "(": 1, ")": -1 }[text[end]] ?? 0;

    if (depth === 0) {
      return text.slice(at, end + 1);
    }
  }

  return text.slice(at);
};

const callsOf = (text, name) =>
  [...text.matchAll(new RegExp(String.raw`\b${name}\s*\(`, "g"))].map((match) =>
    bracketedFrom(text, match.index + match[0].length - 1),
  );

const BSON_NAMES = new Set(["BSON", ...Object.keys(BSON)]);

const notBson = ({ imported }) => !BSON_NAMES.has(imported);

const readsThroughView = (path, local) =>
  callsOf(textOf(path), local).every((call) =>
    /\breadCollection\s*\(/.test(call),
  );

const rawEngineImport =
  (path) =>
  ({ imported, local }) =>
    imported === "readStoredValues"
      ? !readsThroughView(path, local)
      : !ENGINE_HELPERS.includes(imported);

// The names each source may not give Explore, by the import naming them.
const REFUSED_FROM = new Map([
  [MONGO_CLIENT, () => () => true],
  ["mongodb", () => notBson],
  [ENGINE, rawEngineImport],
]);

const rawImports = (path) =>
  importsOf(path).flatMap(({ statement, clause, from }) => {
    if (!from) {
      return [`${path}: ${statement.trim()} (only static imports)`];
    }

    const refused = REFUSED_FROM.get(from)?.(path) ?? (() => false);

    return namesOf(clause)
      .filter(refused)
      .map(({ imported }) => `${path}: ${imported} from ${from}`);
  });

const RAW_ACCESS = /\.\s*(collection|db)\s*\(|\bdb\s*\.\s*collection\b/;

const WRITE_NAME = WRITES.join("|");

// A write method named as a property, a string or a destructured binding.
const WRITE_USE = [
  String.raw`(\.|\[)\s*["'\x60]?(${WRITE_NAME})\b`,
  String.raw`["'\x60](${WRITE_NAME})["'\x60]`,
  String.raw`\{[^{}]*\b(${WRITE_NAME})\b[^{}]*\}\s*=`,
].map((pattern) => new RegExp(pattern, "g"));

const WRITE_STAGE = /\$(out|merge)\b/;

// The view names the write stages only to refuse them.
const STAGE_ALLOWANCE = new Map([
  [VIEW, 'export const WRITE_STAGES = Object.freeze(["$out", "$merge"]);'],
]);

const linesMatching = (path, pattern) =>
  textOf(path)
    .split("\n")
    .filter((line) => pattern.test(line));

const graphFrom = (roots) => {
  const imports = new Map();
  const toRead = [...roots];

  while (toRead.length) {
    const path = toRead.pop();

    if (!imports.has(path)) {
      const reached = importsOf(path)
        .map(({ from }) => from)
        .filter((from) => from?.endsWith(".js") && existsSync(join(SRC, from)));

      imports.set(path, reached);
      toRead.push(...reached);
    }
  }

  return imports;
};

const reachesMongo = (imports, path, seen = new Set()) =>
  path === MONGO_CLIENT ||
  (!seen.has(path) &&
    (seen.add(path),
    imports.get(path).some((next) => reachesMongo(imports, next, seen))));

const cursorStub = () => ({
  toArray: vi.fn(),
  close: vi.fn(),
  [Symbol.asyncIterator]: vi.fn(),
});

describe("Explore reads only", () => {
  it("scans every Explore file and every buckets file it shares", () => {
    const registered = REGISTERING.flatMap(importsOf)
      .map(({ from }) => from)
      .filter((from) => from && isExplore(from));

    expect(registered.length).toBeGreaterThanOrEqual(5);
    expect(scanned).toEqual(
      expect.arrayContaining([VIEW, ENGINE, ...registered, ...sharedFiles]),
    );
    expect(scanned.length).toBeGreaterThan(35);
  });

  it("calls no write method", () => {
    const writing = scanned.flatMap((path) =>
      WRITE_USE.flatMap((pattern) =>
        [...textOf(path).matchAll(pattern)].map(
          ([found]) => `${path}: ${found}`,
        ),
      ),
    );

    expect(WRITES).toEqual(
      expect.arrayContaining(["deleteMany", "dropCollection", "command"]),
    );
    expect(writing).toEqual([]);
  });

  it("names no write stage, but where the view refuses them", () => {
    const writing = scanned.flatMap((path) =>
      linesMatching(path, WRITE_STAGE)
        .filter((line) => line.trim() !== STAGE_ALLOWANCE.get(path))
        .map((line) => `${path}: ${line}`),
    );

    expect(writing).toEqual([]);
  });

  it("takes collections in only through the read-only view", () => {
    const opening = scanned
      .filter((path) => path !== VIEW && !bucketsFiles.includes(path))
      .flatMap((path) => [
        ...linesMatching(path, RAW_ACCESS).map((line) => `${path}: ${line}`),
        ...rawImports(path),
      ]);

    expect(opening).toEqual([]);
  });

  it("reaches Mongo outside its own and the shared files only to audit", () => {
    const imports = graphFrom(exploreFiles);
    const outside = exploreFiles
      .filter((path) => path !== VIEW)
      .flatMap((path) => imports.get(path))
      .filter((path) => !scanned.includes(path));

    expect(
      [...new Set(outside)].filter(
        (path) => path !== AUDIT && reachesMongo(imports, path),
      ),
    ).toEqual([]);
  });

  it("exposes only reads, each reading only through its own method", async () => {
    const collection = Object.fromEntries(
      COLLECTION_METHODS.map((name) => [name, vi.fn(() => cursorStub())]),
    );
    const view = readOnly(collection);

    expect(Object.keys(view).toSorted()).toEqual(READS.toSorted());
    expect(READS.filter((name) => WRITES.includes(name))).toEqual([]);

    for (const name of READS) {
      vi.clearAllMocks();
      await view[name]([]);

      expect(
        COLLECTION_METHODS.filter(
          (method) => collection[method].mock.calls.length,
        ),
      ).toEqual([name]);
    }
  });
});
