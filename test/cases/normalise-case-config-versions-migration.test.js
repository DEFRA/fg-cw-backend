import { MongoClient } from "mongodb";
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
import { up as normaliseConfigVersions } from "../../migrations/20261022110000-normalise-case-config-versions.js";
import { logger } from "../../src/common/logger.js";

vi.mock("../../src/common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const aCase = (caseRef, versions) => ({
  caseRef,
  workflowCode: "example-workflow",
  createdAt: new Date("2026-09-01T10:00:00.000Z"),
  ...versions,
});

const aConfigVersion = (version, overrides = {}) => {
  const [major, minor, patch] = version.split(".").map(Number);

  return {
    grantCode: "example-workflow",
    version,
    status: "active",
    fetchStatus: "fetched",
    major,
    minor,
    patch,
    ...overrides,
  };
};

let client;
let db;

const cases = () => db.collection("cases");

const versionsOf = async (caseRef) =>
  cases().findOne(
    { caseRef },
    {
      projection: {
        _id: 0,
        originalConfigVersion: 1,
        currentConfigVersion: 1,
        configVersion: 1,
      },
    },
  );

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  db = client.db("case-config-versions-migration");
});

afterAll(async () => {
  await db?.dropDatabase();
  await client?.close(true);
});

beforeEach(async () => {
  vi.clearAllMocks();
  await db.dropDatabase();
});

describe("20261022110000-normalise-case-config-versions", () => {
  it("moves a legacy config version into the original and current versions", async () => {
    await cases().insertOne(aCase("legacy", { configVersion: "1.1.0" }));

    await normaliseConfigVersions(db);

    expect(await versionsOf("legacy")).toEqual({
      originalConfigVersion: "1.1.0",
      currentConfigVersion: "1.1.0",
    });
  });

  it("keeps the versions a case holds, and drops the legacy one beside them", async () => {
    await cases().insertOne(
      aCase("both", {
        originalConfigVersion: "1.0.0",
        currentConfigVersion: "1.2.0",
        configVersion: "1.1.0",
      }),
    );

    await normaliseConfigVersions(db);

    expect(await versionsOf("both")).toEqual({
      originalConfigVersion: "1.0.0",
      currentConfigVersion: "1.2.0",
    });
  });

  it("fills a missing current version from the legacy one before the original", async () => {
    await cases().insertOne(
      aCase("half", { originalConfigVersion: "1.0.0", configVersion: "1.1.0" }),
    );

    await normaliseConfigVersions(db);

    expect(await versionsOf("half")).toEqual({
      originalConfigVersion: "1.0.0",
      currentConfigVersion: "1.1.0",
    });
  });

  it("gives a case never moved on the version it started on", async () => {
    await cases().insertOne(
      aCase("unresolved", { originalConfigVersion: "1.0.0" }),
    );

    await normaliseConfigVersions(db);

    expect(await versionsOf("unresolved")).toEqual({
      originalConfigVersion: "1.0.0",
      currentConfigVersion: "1.0.0",
    });
  });

  it("leaves a whole case alone", async () => {
    const whole = aCase("whole", {
      originalConfigVersion: "1.0.0",
      currentConfigVersion: "1.2.0",
    });
    await cases().insertOne(whole);

    await normaliseConfigVersions(db);

    expect(await cases().findOne({ caseRef: "whole" })).toEqual(whole);
  });

  it("gives a case with no version 0.0.0 and its workflow's newest version that resolves", async () => {
    await db
      .collection("config_versions")
      .insertMany([
        aConfigVersion("1.10.0"),
        aConfigVersion("1.9.0"),
        aConfigVersion("2.0.0", { fetchStatus: "permanent_error" }),
        aConfigVersion("3.0.0", { status: "inactive" }),
        aConfigVersion("0.0.0"),
      ]);
    await cases().insertOne(aCase("versionless"));

    await normaliseConfigVersions(db);

    expect(logger.warn).not.toHaveBeenCalled();
    expect(await versionsOf("versionless")).toEqual({
      originalConfigVersion: "0.0.0",
      currentConfigVersion: "1.10.0",
    });
    expect(logger.info).toHaveBeenLastCalledWith(
      "Normalised 0 legacy or partly versioned and 1 versionless case config versions",
    );
  });

  it("leaves the cases of a workflow with no version that resolves unversioned, and warns of each such workflow with its count", async () => {
    await db.collection("config_versions").insertOne(aConfigVersion("0.0.0"));
    const unknown = aCase("unknown-workflow");
    await cases().insertMany([
      unknown,
      aCase("also-unknown"),
      { ...aCase("other-unknown"), workflowCode: "other-workflow" },
    ]);

    await normaliseConfigVersions(db);

    expect(await cases().findOne({ caseRef: "unknown-workflow" })).toEqual(
      unknown,
    );
    expect(logger.warn).toHaveBeenCalledExactlyOnceWith(
      "Cases left without a config version, as their workflow has no version to take: example-workflow (2), other-workflow (1)",
    );
  });

  it("fills a missing original version from the current one", async () => {
    await cases().insertOne(
      aCase("current-only", { currentConfigVersion: "1.2.0" }),
    );

    await normaliseConfigVersions(db);

    expect(await versionsOf("current-only")).toEqual({
      originalConfigVersion: "1.2.0",
      currentConfigVersion: "1.2.0",
    });
    expect(logger.info).toHaveBeenLastCalledWith(
      "Normalised 1 legacy or partly versioned and 0 versionless case config versions",
    );
  });

  it("is safe to run again", async () => {
    await db.collection("config_versions").insertOne(aConfigVersion("1.1.0"));
    await cases().insertMany([
      aCase("legacy", { configVersion: "1.1.0" }),
      aCase("unresolved", { originalConfigVersion: "1.0.0" }),
      aCase("current-only", { currentConfigVersion: "1.2.0" }),
      aCase("versionless"),
    ]);

    await normaliseConfigVersions(db);
    const before = await cases().find().toArray();
    await normaliseConfigVersions(db);

    expect(await cases().find().toArray()).toEqual(before);
    expect(logger.info).toHaveBeenLastCalledWith(
      "Normalised 0 legacy or partly versioned and 0 versionless case config versions",
    );
  });
});
