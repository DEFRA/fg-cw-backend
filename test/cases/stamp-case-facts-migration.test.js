import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { up } from "../../migrations/20261009120000-stamp-case-facts.js";

const aCase = (caseRef, overrides) => ({
  caseRef,
  workflowCode: "example-workflow",
  createdAt: new Date("2026-09-01T10:00:00.000Z"),
  currentStatus: "NEW",
  payload: { identifiers: { sbi: "900000001" } },
  ...overrides,
});

const aSeries = (caseRefs, overrides) => ({
  workflowCode: "example-workflow",
  caseRefs,
  latestCaseRef: caseRefs.at(-1),
  ...overrides,
});

let client;
let db;
let cases;
let series;

const byRef = (caseRef, workflowCode = "example-workflow") =>
  cases.findOne({ caseRef, workflowCode });

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  db = client.db();
  cases = db.collection("cases");
  series = db.collection("case_series");
});

afterAll(async () => {
  await client?.close(true);
});

beforeEach(async () => {
  await Promise.all([cases.deleteMany({}), series.deleteMany({})]);
});

describe("20261009120000-stamp-case-facts", () => {
  it("gives every case its refs, and no replaced flag", async () => {
    await cases.insertOne(aCase("ABC-123"));

    await up(db);

    expect(await byRef("ABC-123")).not.toHaveProperty("replaced");
    expect((await byRef("ABC-123")).refs).toEqual([
      "ref:abc-123",
      "sbi:900000001",
    ]);
  });

  it("gives a case with no SBI the reference alone", async () => {
    await cases.insertOne(aCase("abc-123", { payload: {} }));

    await up(db);

    expect((await byRef("abc-123")).refs).toEqual(["ref:abc-123"]);
  });

  it("links every member of a series by every member's ref", async () => {
    await cases.insertMany([
      aCase("ref-1"),
      aCase("ref-2"),
      aCase("ref-3"),
      aCase("ref-9"),
      aCase("ref-1", { workflowCode: "other-workflow" }),
    ]);
    await series.insertMany([
      aSeries(["ref-1", "ref-2", "ref-3"]),
      aSeries(["ref-9"]),
    ]);

    await up(db);

    const members = await cases
      .find({ workflowCode: "example-workflow", refs: "ref:ref-2" })
      .sort({ caseRef: 1 })
      .toArray();

    expect(members.map(({ caseRef }) => caseRef)).toEqual([
      "ref-1",
      "ref-2",
      "ref-3",
    ]);
    expect((await byRef("ref-9")).refs).not.toContain("ref:ref-2");
    expect(await byRef("ref-1", "other-workflow")).toMatchObject({
      refs: expect.not.arrayContaining(["ref:ref-2"]),
    });
  });

  it("links a series whose latest member has no case yet", async () => {
    await cases.insertOne(aCase("ref-1"));
    await series.insertOne(aSeries(["ref-1", "ref-2"]));

    await up(db);

    expect(await byRef("ref-1")).toMatchObject({
      refs: expect.arrayContaining(["ref:ref-1", "ref:ref-2"]),
    });
  });

  it("is safe to run again", async () => {
    await cases.insertMany([aCase("ref-1"), aCase("ref-2")]);
    await series.insertOne(aSeries(["ref-1", "ref-2"]));

    await up(db);
    const before = await cases.find().toArray();
    await up(db);

    expect(await cases.find().toArray()).toEqual(before);
  });

  it("keeps the refs a writer has already stored", async () => {
    await cases.insertOne(aCase("ref-1", { refs: ["ref:ref-1", "ref:ref-2"] }));

    await up(db);

    expect((await byRef("ref-1")).refs).toEqual([
      "ref:ref-1",
      "ref:ref-2",
      "sbi:900000001",
    ]);
  });
});
