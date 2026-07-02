import { MongoClient } from "mongodb";
import { env } from "node:process";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { processConfigVersionUseCase } from "../../../src/cases/use-cases/process-config-version.use-case.js";
import { FetchStatus } from "../../../src/common/fetch-status.js";

let client;
let configVersionsCol;

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  const db = client.db();
  configVersionsCol = db.collection("config_versions");
});

beforeEach(async () => {
  await configVersionsCol.deleteMany({});
});

afterEach(async () => {
  await configVersionsCol.deleteMany({});
});

afterAll(async () => {
  await client?.close();
});

// Config broker messages are delivered by the SQS subscriber, which calls
// processConfigVersionUseCase directly (the broker topic is a standard,
// non-FIFO SNS topic, so the inbox pattern adds nothing here).
describe("config broker message flow", () => {
  it("should process a config broker message and create a config_versions record", async () => {
    await processConfigVersionUseCase({
      grantCode: "pigs-might-fly",
      version: "1.2.3",
      status: "active",
    });

    const cvDoc = await configVersionsCol.findOne({
      grantCode: "pigs-might-fly",
      version: "1.2.3",
    });
    expect(cvDoc).not.toBeNull();
    expect(cvDoc.major).toBe(1);
    expect(cvDoc.minor).toBe(2);
    expect(cvDoc.patch).toBe(3);
    expect(cvDoc.fetchStatus).toBe(FetchStatus.Pending);
    expect(cvDoc.s3Key).toBe("pigs-might-fly/1.2.3/workflow-definition.json");
  });

  it("should reject a config version with invalid semver and create no record", async () => {
    await expect(
      processConfigVersionUseCase({
        grantCode: "pigs-might-fly",
        version: "not-a-version",
        status: "active",
      }),
    ).rejects.toThrow("Invalid semver version");

    const cvCount = await configVersionsCol.countDocuments({
      grantCode: "pigs-might-fly",
    });
    expect(cvCount).toBe(0);
  });

  it("should handle duplicate messages via upsert without error", async () => {
    const eventData = {
      grantCode: "pigs-might-fly",
      version: "2.0.0",
      status: "active",
    };

    await processConfigVersionUseCase(eventData);
    await processConfigVersionUseCase(eventData);

    const cvCount = await configVersionsCol.countDocuments({
      grantCode: "pigs-might-fly",
      version: "2.0.0",
    });
    expect(cvCount).toBe(1);
  });
});
