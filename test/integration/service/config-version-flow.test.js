import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getInboxEvent, redriveInboxEvent } from "../../helpers/actuators.js";
import {
  aGrantCode,
  CONFIG_BUCKET,
  cwKey,
  manifestFor,
  publishConfigVersion,
  putConfigFile,
  workflowDefinition,
} from "../../helpers/config-broker.js";

// End to end through the running service: the broker's topic, the service's
// queue, its inbox worker, S3 and Mongo.
const SETTLE = { timeout: 30000, interval: 200 };

let client;
let inbox;
let configVersions;

const inboxRowFor = (grantCode) => inbox.findOne({ segregationRef: grantCode });

const settlesAs = async (grantCode, status) => {
  await expect
    .poll(async () => (await inboxRowFor(grantCode))?.status, SETTLE)
    .toBe(status);

  return inboxRowFor(grantCode);
};

const versionsOf = (grantCode) => configVersions.find({ grantCode }).toArray();

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  inbox = client.db().collection("inbox");
  configVersions = client.db().collection("config_versions");
});

afterAll(async () => {
  await configVersions.deleteMany({ grantCode: /^e2e-/ });
  await client?.close();
});

describe("config broker message flow", { timeout: 60000 }, () => {
  it("records a published version through the inbox", async () => {
    const grantCode = aGrantCode("e2e-good");
    await putConfigFile(
      cwKey(grantCode, "1.2.3"),
      workflowDefinition(grantCode),
    );

    await publishConfigVersion({
      manifest: manifestFor(grantCode, "1.2.3"),
      grant: grantCode,
      version: "1.2.3",
    });

    const row = await settlesAs(grantCode, "COMPLETED");

    expect(row).toMatchObject({
      source: "CB",
      type: "config-version.updated",
      completionAttempts: 0,
    });
    const [version] = await versionsOf(grantCode);
    expect(version).toMatchObject({
      version: "1.2.3",
      status: "active",
      s3Bucket: CONFIG_BUCKET,
      s3Key: cwKey(grantCode, "1.2.3"),
    });
  });

  it("dead-letters a message without a path attribute", async () => {
    const grantCode = aGrantCode("e2e-nopath");
    await putConfigFile(
      cwKey(grantCode, "1.0.0"),
      workflowDefinition(grantCode),
    );

    await publishConfigVersion({
      manifest: manifestFor(grantCode, "1.0.0"),
      grant: grantCode,
      version: "1.0.0",
      path: undefined,
    });

    const row = await settlesAs(grantCode, "DEAD_LETTER");

    expect(row.completionAttempts).toBe(1);
    expect(row.retryable).toBe(false);
    expect(row.lastError.message).toContain("has no bucket (path attribute)");
    await expect(versionsOf(grantCode)).resolves.toEqual([]);
  });

  it("completes a dead-lettered version once its cw.json is uploaded and an operator redrives it", async () => {
    const grantCode = aGrantCode("e2e-redrive");

    await publishConfigVersion({
      manifest: manifestFor(grantCode, "1.0.0"),
      grant: grantCode,
      version: "1.0.0",
    });

    const dead = await settlesAs(grantCode, "DEAD_LETTER");
    expect(dead.completionAttempts).toBe(1);
    expect(dead.lastError.message).toContain("S3 object not found");
    await expect(versionsOf(grantCode)).resolves.toEqual([]);

    const id = dead._id.toHexString();
    const { payload: detail } = await getInboxEvent(id);
    expect(detail).toMatchObject({
      type: "config-version.updated",
      source: "CB",
      segregationRef: grantCode,
      status: "DEAD_LETTER",
    });

    await putConfigFile(
      cwKey(grantCode, "1.0.0"),
      workflowDefinition(grantCode),
    );
    await redriveInboxEvent(id, { by: "operator@defra.gov.uk" });

    const row = await settlesAs(grantCode, "COMPLETED");

    expect(row.retryable).toBe(true);
    await expect(versionsOf(grantCode)).resolves.toHaveLength(1);
  });
});
