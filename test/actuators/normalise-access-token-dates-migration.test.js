import { Decimal128, MongoClient, ObjectId } from "mongodb";
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
import { up } from "../../migrations/20261104115000-normalise-access-token-dates.js";
import { isActiveRecord } from "../../src/clients/models/access-token.js";
import { logger } from "../../src/common/logger.js";

// A database of its own, so the service's live tokens are never touched.
const DATABASE = "normalise-access-token-dates-migration";

const FUTURE = new Date("2099-01-01T00:00:00.000Z");
const PAST = new Date("2020-01-01T00:00:00.000Z");

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
    client: "grants-ui",
    ...fields,
  });

  return _id;
};

const rowOf = (_id) => accessTokens.findOne({ _id });

const expiryOf = async (_id) => (await rowOf(_id)).expiresAt;

const isActive = async (_id) => isActiveRecord(await rowOf(_id));

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

describe("20261104115000-normalise-access-token-dates", () => {
  it.each([
    ["a future epoch number", FUTURE.getTime(), FUTURE],
    ["a past epoch number", PAST.getTime(), PAST],
    ["a future epoch number as a string", String(FUTURE.getTime()), FUTURE],
    ["a past epoch number as a string", String(PAST.getTime()), PAST],
    [
      "a future epoch number as a Decimal128",
      Decimal128.fromString(String(FUTURE.getTime())),
      FUTURE,
    ],
    [
      "a past epoch number as a Decimal128",
      Decimal128.fromString(String(PAST.getTime())),
      PAST,
    ],
    ["an array holding a future epoch number", [FUTURE.getTime()], FUTURE],
    ["true, which auth reads as 1", true, new Date(1)],
    ["an empty array, which auth reads as 0", [], new Date(0)],
    ["an array holding null, which auth reads as 0", [null], new Date(0)],
  ])(
    "turns %s into the date auth expires it at",
    async (_, expiresAt, date) => {
      const _id = await insert({ expiresAt });
      const wasActive = await isActive(_id);

      await up(db);

      expect(await expiryOf(_id)).toEqual(date);
      expect(await isActive(_id)).toBe(wasActive);
    },
  );

  it.each([
    ["zero", 0],
    ["a number past 9999", Date.UTC(10000, 0, 1)],
    ["the largest safe integer", Number.MAX_SAFE_INTEGER],
    ["a word", "never"],
    ["a date as a string", "2020-01-01T00:00:00.000Z"],
    ["false", false],
    ["an object", { at: "never" }],
    ["an array holding a date", [FUTURE]],
    ["a date past 9999", new Date("+010000-01-01T00:00:00.000Z")],
  ])("sets %s, which auth never expires, to never", async (_, expiresAt) => {
    const _id = await insert({ expiresAt });
    expect(await isActive(_id)).toBe(true);

    await up(db);

    expect(await expiryOf(_id)).toBeNull();
    expect(await isActive(_id)).toBe(true);
  });

  it.each([
    ["a negative number", -1],
    ["a negative number as a string", "-1"],
    ["a date before 1970", new Date("1969-12-31T23:59:59.999Z")],
  ])(
    "expires %s, which auth already refuses, as of now",
    async (_, expiresAt) => {
      const _id = await insert({ expiresAt });
      expect(await isActive(_id)).toBe(false);
      const before = new Date();

      await up(db);

      const expiry = await expiryOf(_id);

      expect(expiry).toBeInstanceOf(Date);
      expect(expiry.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(await isActive(_id)).toBe(false);
    },
  );

  it("keeps a revoked token revoked, whatever its expiry held", async () => {
    const _id = await insert({ expiresAt: "never", revokedAt: PAST });

    await up(db);

    expect(await rowOf(_id)).toMatchObject({
      expiresAt: null,
      revokedAt: PAST,
    });
    expect(await isActive(_id)).toBe(false);
  });

  it.each([
    ["a date before 1970", new Date("1969-12-31T23:59:59.999Z")],
    ["a date past 9999", new Date("+010000-01-01T00:00:00.000Z")],
    ["a word", "yes"],
    ["false", false],
    ["an array holding null", [null]],
  ])(
    "keeps a token revoked whose revokedAt is %s, revoked as of now",
    async (_, revokedAt) => {
      const _id = await insert({ expiresAt: FUTURE, revokedAt });
      expect(await isActive(_id)).toBe(false);
      const before = new Date();

      await up(db);

      const row = await rowOf(_id);

      expect(row.revokedAt).toBeInstanceOf(Date);
      expect(row.revokedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(row.expiresAt).toEqual(FUTURE);
      expect(await isActive(_id)).toBe(false);
    },
  );

  it.each([
    ["a date before 1970", new Date("1969-12-31T23:59:59.999Z")],
    ["a date past 9999", new Date("+010000-01-01T00:00:00.000Z")],
    ["a number", 0],
    ["an array holding a date", [PAST]],
  ])(
    "dates a createdAt of %s by its ObjectId, still active",
    async (_, createdAt) => {
      const _id = await insert({ expiresAt: null, createdAt });

      await up(db);

      expect((await rowOf(_id)).createdAt).toEqual(_id.getTimestamp());
      expect(await isActive(_id)).toBe(true);
    },
  );

  it("records a bad createdAt as unknown when the key is not an ObjectId", async () => {
    await accessTokens.insertOne({
      _id: "hand-made",
      id: "f".repeat(64),
      client: "grants-ui",
      createdAt: "yesterday",
    });

    await up(db);

    expect((await accessTokens.findOne({ _id: "hand-made" })).createdAt).toBe(
      null,
    );
  });

  it("leaves dates, null, a missing expiry and every other field alone", async () => {
    const dated = await insert({
      expiresAt: FUTURE,
      revokedAt: PAST,
      createdAt: PAST,
      tokenHint: "abcd",
    });
    const first = await insert({ expiresAt: new Date(0) });
    const never = await insert({ expiresAt: null });
    const missing = await insert({});
    const bad = await insert({ expiresAt: "never", createdBy: "Jane" });
    const before = await rowOf(bad);

    await up(db);

    expect(await rowOf(dated)).toMatchObject({
      expiresAt: FUTURE,
      revokedAt: PAST,
      createdAt: PAST,
      tokenHint: "abcd",
    });
    expect(await expiryOf(first)).toEqual(new Date(0));
    expect(await expiryOf(never)).toBeNull();
    expect(await rowOf(missing)).not.toHaveProperty("expiresAt");
    expect(await rowOf(bad)).toEqual({ ...before, expiresAt: null });
  });

  it("can run again, changing nothing", async () => {
    await insert({ expiresAt: "never" });
    await insert({ expiresAt: -1 });
    await insert({ expiresAt: FUTURE.getTime() });
    await insert({ expiresAt: [null], revokedAt: "yes", createdAt: 0 });
    await up(db);
    const once = await accessTokens.find().toArray();

    await up(db);

    expect(await accessTokens.find().toArray()).toEqual(once);
  });

  it("logs the count only", async () => {
    const info = vi.spyOn(logger, "info");
    await insert({ expiresAt: "never" });
    await insert({ expiresAt: null });

    await up(db);

    const logged = JSON.stringify(info.mock.calls);

    expect(logged).toContain("Normalised the dates of 1 access tokens");
    expect(logged).not.toContain("never");
  });
});
