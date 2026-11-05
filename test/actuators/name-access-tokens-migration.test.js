import { MongoClient, ObjectId } from "mongodb";
import { env } from "node:process";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { up } from "../../migrations/20261104130000-name-access-tokens.js";
import { logger } from "../../src/common/logger.js";

// A database of its own, so the service's live tokens are never touched.
const DATABASE = "name-access-tokens-migration";

let client;
let db;
let accessTokens;
let n = 0;

const insert = async (fields) => {
  const _id = new ObjectId();
  n += 1;
  await accessTokens.insertOne({
    _id,
    id: String(n).padStart(64, "0"),
    expiresAt: null,
    ...fields,
  });

  return _id;
};

const clientOf = async (_id) => (await accessTokens.findOne({ _id })).client;

const unnamed = (_id) => `unnamed-${_id.toHexString().slice(-6)}`;

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  db = client.db(DATABASE);
  accessTokens = db.collection("access_tokens");
});

afterAll(async () => {
  await db.dropDatabase();
  await client?.close(true);
});

beforeEach(async () => {
  await accessTokens.deleteMany({});
  vi.restoreAllMocks();
});

describe("20261104130000-name-access-tokens", () => {
  it.each([
    ["upper case and an underscore", "Grants_UI", "grants-ui"],
    ["spaces", "  grants  ui ", "grants-ui"],
    ["other characters", "grants.ui/v2!", "grants-ui-v2"],
    ["repeated and leading hyphens", "--Grants---UI--", "grants-ui"],
  ])("normalises a name with %s", async (_, stored, normalised) => {
    const _id = await insert({ client: stored });

    await up(db);

    expect(await clientOf(_id)).toBe(normalised);
  });

  it("cuts a long name to 64 characters, with no hyphen left at the end", async () => {
    const _id = await insert({ client: `${"A".repeat(63)}_b` });

    await up(db);

    expect(await clientOf(_id)).toBe("a".repeat(63));
  });

  it.each([
    ["missing", {}],
    ["null", { client: null }],
    ["blank", { client: "   " }],
    ["not a string", { client: 42 }],
    ["nothing once normalised", { client: "___" }],
    ["64 hex characters, as a hash is", { client: "a".repeat(64) }],
    ["64 hex characters once normalised", { client: "A".repeat(64) }],
    ["64 hex characters once cut", { client: "0".repeat(70) }],
  ])("names a row whose client is %s after its token", async (_, fields) => {
    const _id = await insert(fields);

    await up(db);

    expect(await clientOf(_id)).toBe(unnamed(_id));
  });

  // The actuator guard admits fg-gas-backend alone: a row normalised into that
  // name would become a credential for every actuator.
  it.each(["FG_GAS_BACKEND", "fg gas backend", "-Fg-Gas-Backend-"])(
    "never names a row fg-gas-backend, even when %s normalises to it",
    async (stored) => {
      const _id = await insert({ client: stored });

      await up(db);

      expect(await clientOf(_id)).toBe(unnamed(_id));
    },
  );

  // fg-gas-backend's admin guard admits this name alone; a row carrying it in
  // both services' stores must never be made by a migration.
  it.each(["FG_GRANTS_PLATFORM_ADMIN", " fg grants platform admin "])(
    "never names a row fg-grants-platform-admin, even when %s normalises to it",
    async (stored) => {
      const _id = await insert({ client: stored });

      await up(db);

      expect(await clientOf(_id)).toBe(unnamed(_id));
    },
  );

  it("leaves valid names and every other field alone", async () => {
    const valid = await insert({ client: "fg-gas-backend" });
    const bad = await insert({ client: "Grants_UI", createdBy: "Jane" });
    const before = await accessTokens.findOne({ _id: bad });

    await up(db);

    expect(await clientOf(valid)).toBe("fg-gas-backend");
    expect(await accessTokens.findOne({ _id: bad })).toEqual({
      ...before,
      client: "grants-ui",
    });
  });

  it("can run again, changing nothing", async () => {
    await insert({ client: "Grants_UI" });
    await insert({});
    await up(db);
    const once = await accessTokens.find().toArray();

    await up(db);

    expect(await accessTokens.find().toArray()).toEqual(once);
  });

  it("logs counts only", async () => {
    const info = vi.spyOn(logger, "info");
    const _id = await insert({ client: "Grants_UI" });
    await insert({});

    await up(db);

    const logged = JSON.stringify(info.mock.calls);

    expect(logged).toContain("Normalised 1");
    expect(logged).toContain("named 1");
    expect(logged).not.toContain("Grants_UI");
    expect(logged).not.toContain("grants-ui");
    expect(logged).not.toContain(_id.toHexString().slice(-6));
  });
});
