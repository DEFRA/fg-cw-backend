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
import { logger } from "../../src/common/logger.js";
import { up } from "../../migrations/20260914120000-inbox-publication-date-list-indexes-and-normalise.js";

const REF = "MIGRATION-publication-date";
const INSERTED_AT = new Date("2026-01-02T03:04:05.000Z");

let client;
let db;
let inbox;

const idAt = (date) => ObjectId.createFromTime(date.getTime() / 1000);

// A held far-future claim keeps the pollers off the fixtures.
const aDoc = (overrides) => ({
  _id: new ObjectId(),
  segregationRef: REF,
  status: "COMPLETED",
  claimedBy: "test-holder",
  claimExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
  ...overrides,
});

const normalised = (count) =>
  `Normalised ${count} inbox publicationDate values to ISO strings`;

const publicationDateOf = async (_id) =>
  (await inbox.findOne({ _id })).publicationDate;

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  db = client.db();
  inbox = db.collection("inbox");
});

afterAll(async () => {
  await client?.close(true);
});

beforeEach(async () => {
  await inbox.deleteMany({ segregationRef: REF });
});

describe("20260914120000-inbox-publication-date-list-indexes-and-normalise", () => {
  it("leaves a canonical string untouched", async () => {
    const info = vi.spyOn(logger, "info");
    const doc = aDoc({ publicationDate: "2026-06-16T10:00:00.000Z" });
    await inbox.insertOne(doc);

    await up(db);

    expect(await publicationDateOf(doc._id)).toBe("2026-06-16T10:00:00.000Z");
    expect(info).toHaveBeenCalledWith(normalised(0));
  });

  it.each([
    [
      "a BSON Date",
      new Date("2026-06-16T10:02:00.000Z"),
      "2026-06-16T10:02:00.000Z",
    ],
    [
      "an offset string",
      "2026-06-16T11:01:00+01:00",
      "2026-06-16T10:01:00.000Z",
    ],
    [
      "a string without milliseconds",
      "2026-06-16T10:03:00Z",
      "2026-06-16T10:03:00.000Z",
    ],
  ])(
    "normalises %s to a canonical ISO string",
    async (_name, stored, expected) => {
      const info = vi.spyOn(logger, "info");
      const doc = aDoc({ publicationDate: stored });
      await inbox.insertOne(doc);

      await up(db);

      expect(await publicationDateOf(doc._id)).toBe(expected);
      expect(info).toHaveBeenCalledWith(normalised(1));
    },
  );

  it.each([
    ["null", { publicationDate: null }],
    ["missing", {}],
    ["unparseable", { publicationDate: "not a date" }],
  ])("falls back to the _id timestamp when %s", async (_name, overrides) => {
    const doc = aDoc({ _id: idAt(INSERTED_AT), ...overrides });
    await inbox.insertOne(doc);

    await up(db);

    expect(await publicationDateOf(doc._id)).toBe(INSERTED_AT.toISOString());
  });

  it("is safe to run again", async () => {
    const doc = aDoc({ publicationDate: new Date("2026-06-16T10:02:00.000Z") });
    await inbox.insertOne(doc);

    await up(db);
    await up(db);

    expect(await publicationDateOf(doc._id)).toBe("2026-06-16T10:02:00.000Z");
  });
});
