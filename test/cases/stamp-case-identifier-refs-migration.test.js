import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { up } from "../../migrations/20261111120000-stamp-case-identifier-refs.js";

const aCase = (caseRef, identifiers, overrides) => ({
  caseRef,
  workflowCode: "example-workflow",
  createdAt: new Date("2026-09-01T10:00:00.000Z"),
  currentStatus: "NEW",
  payload: { identifiers },
  refs: [`ref:${caseRef}`],
  ...overrides,
});

let client;
let cases;

const refsOf = async (caseRef) => (await cases.findOne({ caseRef })).refs;

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  cases = client.db().collection("cases");
});

afterAll(async () => {
  await client?.close(true);
});

beforeEach(async () => {
  await cases.deleteMany({});
});

describe("20261111120000-stamp-case-identifier-refs", () => {
  it("gives every case the FRN and CRN it was submitted with", async () => {
    await cases.insertOne(
      aCase("ref-1", { sbi: "900000001", frn: "1100000001", crn: "CRN01" }),
    );

    await up(client.db());

    expect(await refsOf("ref-1")).toEqual([
      "ref:ref-1",
      "sbi:900000001",
      "frn:1100000001",
      "crn:crn01",
    ]);
  });

  it("stamps only the identifiers a case has", async () => {
    await cases.insertMany([
      aCase("ref-1", { sbi: "900000001" }),
      aCase("ref-2", { crn: "CRN02" }),
      aCase("ref-3", undefined, { payload: {} }),
    ]);

    await up(client.db());

    expect(await refsOf("ref-1")).toEqual(["ref:ref-1", "sbi:900000001"]);
    expect(await refsOf("ref-2")).toEqual(["ref:ref-2", "crn:crn02"]);
    expect(await refsOf("ref-3")).toEqual(["ref:ref-3"]);
  });

  it("keeps the refs a case already has, such as its series", async () => {
    await cases.insertOne(
      aCase(
        "ref-1",
        { frn: "1100000001" },
        { refs: ["ref:ref-1", "ref:ref-0"] },
      ),
    );

    await up(client.db());

    expect(await refsOf("ref-1")).toEqual([
      "ref:ref-1",
      "ref:ref-0",
      "frn:1100000001",
    ]);
  });

  it("stamps more cases than fit in one batch", async () => {
    await cases.insertMany(
      Array.from({ length: 1001 }, (_, n) =>
        aCase(`ref-${n}`, { crn: `CRN${n}` }),
      ),
    );

    await up(client.db());

    expect(await cases.countDocuments({ refs: /^crn:/ })).toBe(1001);
  });

  it("is safe to run again", async () => {
    await cases.insertOne(aCase("ref-1", { frn: "1100000001", crn: "CRN01" }));

    await up(client.db());
    const before = await cases.find().toArray();
    await up(client.db());

    expect(await cases.find().toArray()).toEqual(before);
  });
});
