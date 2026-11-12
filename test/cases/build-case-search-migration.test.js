import { Collection, MongoClient, ObjectId } from "mongodb";
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
import { up as buildCaseSearch } from "../../migrations/20261111130000-build-case-search.js";
import { logger } from "../../src/common/logger.js";
import {
  NO_DECLARATION,
  declarationOf,
} from "../../src/common/search/declarations.js";

vi.mock("../../src/common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const search = {
  fields: [
    {
      key: "businessName",
      label: "Business name",
      path: "$.payload.answers.business.name",
      match: "prefix",
    },
    {
      key: "agreementRef",
      label: "Agreement reference",
      path: "$.supplementaryData.agreements[*].agreementRef",
    },
  ],
};

const id = (n) =>
  ObjectId.createFromHexString(n.toString(16).padStart(24, "0"));

const createdAt = (n) => new Date(Date.UTC(2026, 8, 1, 10, 0, n));

const aCase = (n, workflowCode, payload, supplementaryData) => ({
  _id: id(n),
  caseRef: `ref-${n}`,
  workflowCode,
  createdAt: createdAt(n),
  payload,
  supplementaryData,
});

let client;
let db;

const searchDocs = () =>
  db
    .collection("case_search")
    .find({}, { sort: { _id: 1 } })
    .toArray();

// Its own database, so the running service's reindexer never touches it.
beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  db = client.db("build-case-search-migration");
});

afterAll(async () => {
  await db?.dropDatabase();
  await client?.close(true);
});

const configVersion = (grantCode, version, status) => {
  const [major, minor, patch] = version.split(".").map(Number);

  return {
    grantCode,
    version,
    major,
    minor,
    patch,
    status,
  };
};

beforeEach(async () => {
  await db.dropDatabase();
  await db
    .collection("config_versions")
    .insertMany([
      configVersion("workflow-a", "1.2.0", "active"),
      configVersion("workflow-a", "1.10.0", "active"),
      configVersion("workflow-a", "2.0.0", "draft"),
      configVersion("workflow-b", "1.0.0", "active"),
      configVersion("workflow-c", "1.0.0", "active"),
      configVersion("workflow-c", "1.1.0", "active"),
    ]);
  await db.collection("workflows").insertMany([
    { code: "workflow-a", version: "1.2.0" },
    { code: "workflow-a", version: "1.10.0", search },
    {
      code: "workflow-a",
      version: "2.0.0",
      search: {
        fields: [{ key: "draft", label: "Draft", path: "$.payload.draft" }],
      },
    },
    { code: "workflow-b", version: "1.0.0" },
    { code: "workflow-c", version: "1.0.0", search },
  ]);
  await db
    .collection("config_changes")
    .insertOne({ _id: "workflow-a", change: 3 });
});

describe("20261111130000-build-case-search", () => {
  it("creates the search and reindexer indexes", async () => {
    await buildCaseSearch(db);

    const indexes = await db.collection("case_search").indexes();

    expect(indexes.map(({ key }) => key)).toEqual([
      { _id: 1 },
      { workflowCode: 1, keys: 1, createdAt: -1, _id: -1 },
      { workflowCode: 1, sig: 1, stamp: 1 },
    ]);
  });

  it("gives every case a document from its workflow's current declaration", async () => {
    await db
      .collection("cases")
      .insertMany([
        aCase(
          1,
          "workflow-a",
          { answers: { business: { name: "Hilltop Farm" } } },
          { agreements: [{ agreementRef: "AG-1" }, { agreementRef: "AG 2" }] },
        ),
        aCase(2, "workflow-b", { answers: { business: { name: "Valley" } } }),
        aCase(3, "workflow-unpublished", {}),
        aCase(4, "workflow-a", undefined, undefined),
        aCase(5, "workflow-c", { answers: { business: { name: "Hilltop" } } }),
      ]);

    await buildCaseSearch(db);

    expect(await searchDocs()).toEqual([
      {
        _id: id(1),
        workflowCode: "workflow-a",
        createdAt: createdAt(1),
        keys: [
          "businessName:hilltopfarm",
          "agreementRef:ag1",
          "agreementRef:ag2",
        ],
        sig: declarationOf(search).sig,
        stamp: declarationOf(search, 3).stamp,
      },
      {
        _id: id(2),
        workflowCode: "workflow-b",
        createdAt: createdAt(2),
        keys: [],
        sig: declarationOf(null).sig,
        stamp: declarationOf(null, 0).stamp,
      },
      expect.objectContaining({
        _id: id(3),
        keys: [],
        sig: NO_DECLARATION.sig,
        stamp: NO_DECLARATION.stamp,
      }),
      expect.objectContaining({
        _id: id(4),
        keys: [],
        sig: declarationOf(search).sig,
      }),
      expect.objectContaining({
        _id: id(5),
        keys: ["businessName:hilltop"],
        sig: declarationOf(search).sig,
      }),
    ]);
    expect(logger.info).toHaveBeenCalledWith(
      "Gave 5 cases their search documents, 3 of them with no keys",
    );
  });

  it("stamps each document with its algorithm and its workflow's count of config changes", async () => {
    await db
      .collection("cases")
      .insertMany([aCase(1, "workflow-a", {}), aCase(2, "workflow-b", {})]);

    await buildCaseSearch(db);

    expect((await searchDocs()).map(({ stamp }) => stamp)).toEqual([
      "0003:000000000003",
      "0003:000000000000",
    ]);
  });

  it("logs the counts, and does not fail, when an older instance inserts a case meanwhile", async () => {
    await db.collection("cases").insertOne(aCase(1, "workflow-a", {}));
    const bulkWrite = Collection.prototype.bulkWrite;
    const written = vi
      .spyOn(Collection.prototype, "bulkWrite")
      .mockImplementationOnce(async function (...args) {
        await db.collection("cases").insertOne(aCase(2, "workflow-a", {}));

        return bulkWrite.apply(this, args);
      });

    try {
      await buildCaseSearch(db);
    } finally {
      written.mockRestore();
    }

    expect(logger.info).toHaveBeenCalledWith(
      "Search case_search: 1 documents for 2 cases",
    );
  });

  it("counts what it could not index, never the values, and still writes the document", async () => {
    await db
      .collection("cases")
      .insertOne(
        aCase(
          1,
          "workflow-a",
          { answers: { business: { name: { text: "Hidden Value" } } } },
          { agreements: [{ agreementRef: "AG-1" }, { agreementRef: true }] },
        ),
      );

    await buildCaseSearch(db);

    expect((await searchDocs())[0].keys).toEqual(["agreementRef:ag1"]);
    expect(logger.warn).toHaveBeenCalledWith(
      "Search case_search: values not indexed on 1 records: businessName (1 not text, 0 over the caps), agreementRef (1 not text, 0 over the caps)",
    );
    expect(JSON.stringify(logger.warn.mock.calls)).not.toMatch(/hidden/i);
  });

  it("replaces a document already written, so it can run again", async () => {
    await db
      .collection("cases")
      .insertOne(
        aCase(1, "workflow-a", { answers: { business: { name: "Hilltop" } } }),
      );
    await db.collection("case_search").insertOne({
      _id: id(1),
      workflowCode: "workflow-a",
      keys: ["businessName:old"],
      sig: "x",
    });

    await buildCaseSearch(db);
    await buildCaseSearch(db);

    expect(await searchDocs()).toEqual([
      expect.objectContaining({ keys: ["businessName:hilltop"] }),
    ]);
  });
});
