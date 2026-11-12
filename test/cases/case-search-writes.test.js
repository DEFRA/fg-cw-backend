import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { Case } from "../../src/cases/models/case.js";

vi.mock("../../src/common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const WORKFLOW = "search-writes-workflow";

const search = {
  fields: [
    {
      key: "agreementReference",
      label: "Agreement reference",
      path: "$.supplementaryData.agreements[*].agreementRef",
    },
  ],
};

let mongoClient;
let db;
let repository;

const keysOf = async (kase) =>
  (await db.collection("case_search").findOne({ _id: kase.objectId })).keys;

beforeAll(async () => {
  vi.stubEnv("MONGO_DATABASE", "case-search-writes-test");
  vi.resetModules();

  ({ mongoClient, db } = await import("../../src/common/mongo-client.js"));
  repository = await import("../../src/cases/repositories/case.repository.js");

  await mongoClient.connect();
});

afterAll(async () => {
  await db?.dropDatabase();
  await mongoClient?.close();
  vi.unstubAllEnvs();
});

beforeEach(async () => {
  await db.dropDatabase();
  await db.collection("config_versions").insertOne({
    grantCode: WORKFLOW,
    version: "1.0.0",
    major: 1,
    minor: 0,
    patch: 0,
    status: "active",
    receivedAt: "2026-10-01T09:00:00.000Z",
  });
  await db
    .collection("workflows")
    .insertOne({ code: WORKFLOW, version: "1.0.0", search });
});

describe("indexing a written case", () => {
  it("indexes what the case holds once written, not what one writer loaded", async () => {
    const kase = Case.createMock({
      workflowCode: WORKFLOW,
      supplementaryData: { agreements: [{ agreementRef: "AG-X" }] },
    });
    await repository.save(kase);
    const [writerA, writerB] = await Promise.all([
      repository.findById(kase._id),
      repository.findById(kase._id),
    ]);

    writerB.updateSupplementaryData({
      targetNode: "agreements",
      dataType: "ARRAY",
      key: "agreementRef",
      data: { agreementRef: "AG-Y" },
    });
    await repository.updateSupplementaryData(writerB);
    writerA.updateSupplementaryData({
      targetNode: "notes",
      dataType: "ARRAY",
      key: "id",
      data: { id: "note-1" },
    });
    await repository.update(writerA);

    expect(await keysOf(kase)).toEqual([
      "agreementReference:agx",
      "agreementReference:agy",
    ]);
  });
});
