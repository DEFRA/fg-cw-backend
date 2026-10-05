import { MongoClient, ObjectId } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { logger } from "../../src/common/logger.js";
import { up } from "../../migrations/20261005120000-normalise-case-created-at.js";
import { searchCases, seedCaseReaderToken } from "../helpers/actuators.js";

const INSERTED_AT = new Date("2026-01-02T03:04:05.000Z");

let client;
let db;
let cases;

const idAt = (date) => ObjectId.createFromTime(date.getTime() / 1000);

const aCase = (caseRef, overrides = {}) => ({
  _id: new ObjectId(),
  caseRef,
  workflowCode: "frps",
  currentPhase: "PRE_AWARD",
  currentStage: "REVIEW",
  currentStatus: "NEW",
  closed: false,
  closedAt: null,
  payload: { answers: { opaque: true } },
  comments: [],
  timeline: [],
  ...overrides,
});

const normalised = (count) =>
  `Normalised ${count} case createdAt values to Dates`;

const rawOf = (_id) => cases.findOne({ _id }, { raw: true });

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  db = client.db();
  cases = db.collection("cases");
  await seedCaseReaderToken(db);
});

afterAll(async () => {
  await client?.close(true);
});

describe("20261005120000-normalise-case-created-at", () => {
  it.each([
    [
      "an offset string",
      "2026-06-16T11:01:00+01:00",
      new Date("2026-06-16T10:01:00.000Z"),
    ],
    [
      "a string without milliseconds",
      "2026-06-16T10:03:00Z",
      new Date("2026-06-16T10:03:00.000Z"),
    ],
  ])("converts %s to its Date", async (_name, stored, expected) => {
    const info = vi.spyOn(logger, "info");
    const doc = aCase("ref-1", { createdAt: stored });
    await cases.insertOne(doc);

    await up(db);

    expect(await cases.findOne({ _id: doc._id })).toEqual({
      ...doc,
      createdAt: expected,
    });
    expect(info).toHaveBeenCalledWith(normalised(1));
  });

  it.each([
    ["missing", {}],
    ["null", { createdAt: null }],
    ["unparsable", { createdAt: "not a date" }],
  ])("falls back to the _id timestamp when %s", async (_name, overrides) => {
    const doc = aCase("ref-1", { _id: idAt(INSERTED_AT), ...overrides });
    await cases.insertOne(doc);

    await up(db);

    expect(await cases.findOne({ _id: doc._id })).toEqual({
      ...doc,
      createdAt: INSERTED_AT,
    });
  });

  it("leaves a Date row byte for byte as it was", async () => {
    const info = vi.spyOn(logger, "info");
    const doc = aCase("ref-1", {
      createdAt: new Date("2026-06-16T10:00:00.123Z"),
    });
    await cases.insertOne(doc);
    const before = await rawOf(doc._id);

    await up(db);

    expect((await rawOf(doc._id)).equals(before)).toBe(true);
    expect(info).toHaveBeenCalledWith(normalised(0));
  });

  it("is safe to run again", async () => {
    const info = vi.spyOn(logger, "info");
    const doc = aCase("ref-1", { createdAt: "2026-06-16T10:03:00Z" });
    await cases.insertOne(doc);

    await up(db);
    const once = await rawOf(doc._id);
    await up(db);

    expect((await rawOf(doc._id)).equals(once)).toBe(true);
    expect(info).toHaveBeenLastCalledWith(normalised(0));
  });

  it("lets a browse return every case, newest first", async () => {
    await cases.insertMany([
      aCase("dated", { createdAt: new Date("2026-06-16T12:00:00.000Z") }),
      aCase("offset", { createdAt: "2026-06-16T12:00:00+01:00" }),
      aCase("missing", { _id: idAt(new Date("2026-06-16T10:00:00.000Z")) }),
      aCase("unparsable", {
        _id: idAt(new Date("2026-06-16T09:00:00.000Z")),
        createdAt: "not a date",
      }),
      aCase("null", {
        _id: idAt(new Date("2026-06-16T08:00:00.000Z")),
        createdAt: null,
      }),
    ]);

    await up(db);

    const response = await searchCases({});

    expect(response.payload.cases.map(({ ref }) => ref.caseRef)).toEqual([
      "dated",
      "offset",
      "missing",
      "unparsable",
      "null",
    ]);
    expect(response.payload.total).toEqual({ count: 5, capped: false });
  });
});
