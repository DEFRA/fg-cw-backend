import { MongoClient, MongoNetworkError } from "mongodb";
import { env } from "node:process";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  aGrantCode,
  CONFIG_BUCKET,
  createQueue,
  cwKey,
  manifestFor,
  purgeQueue,
  putConfigFile,
  receiveMessage,
  sendConfigVersion,
  workflowDefinition,
} from "../../helpers/config-broker.js";

// Its own database and queue, so the containerised service - which consumes
// the broker queue and polls its own inbox - cannot take these events first.
// S3, SQS and Mongo are the real ones from the compose stack.
const DATABASE = "fg-cw-backend-config-inbox-test";
const QUEUE_URL = env.CW__SQS__CONFIG_VERSION_QUEUE_URL.replace(
  /[^/]+$/,
  "cw__sqs__config_version_inbox_test",
);
const MAX_RETRIES = Number(env.INBOX_MAX_RETRIES);

vi.stubEnv("MONGO_DATABASE", DATABASE);
vi.stubEnv("CW__SQS__CONFIG_VERSION_QUEUE_URL", QUEUE_URL);
vi.resetModules();

// Faults injected by grant, so one test's S3 or Mongo can misbehave while the
// real one serves everything else.
const faults = vi.hoisted(() => {
  const injected = new Map();

  return {
    inject: (target, grantCode, error, times = Infinity) =>
      injected.set(`${target}:${grantCode}`, { error, times }),
    hit: (target, grantCode) => {
      const fault = injected.get(`${target}:${grantCode}`);
      if (fault?.times > 0) {
        fault.times -= 1;
        throw fault.error();
      }
    },
    clear: () => injected.clear(),
  };
});

vi.mock("../../../src/common/s3-client.js", async (importOriginal) => {
  const original = await importOriginal();

  return {
    ...original,
    fetchConfigFile: async (bucket, key) => {
      faults.hit("fetch", key.split("/")[0]);
      return original.fetchConfigFile(bucket, key);
    },
  };
});

vi.mock(
  "../../../src/cases/repositories/config-version.repository.js",
  async (importOriginal) => {
    const original = await importOriginal();

    return {
      ...original,
      upsert: async (configVersion) => {
        faults.hit("upsert", configVersion.grantCode);
        return original.upsert(configVersion);
      },
    };
  },
);

const { db: serviceDb } = await import("../../../src/common/mongo-client.js");
const { logger } = await import("../../../src/common/logger.js");
const { S3FetchError } = await import("../../../src/common/s3-client.js");
const { InboxSubscriber } =
  await import("../../../src/cases/subscribers/inbox.subscriber.js");
const { configVersionUpdatedSubscriber } =
  await import("../../../src/cases/subscribers/config-version-updated.subscriber.js");
const { redriveById } =
  await import("../../../src/cases/repositories/inbox.repository.js");

const W3C_TRACEPARENT = /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/;
const SETTLE = { timeout: 30000, interval: 100 };

let client;
let inbox;
let configVersions;
let worker = null;
let workerLoop = null;

const startWorker = () => {
  worker = new InboxSubscriber();
  worker.running = true;
  workerLoop = worker.poll();
};

const stopWorker = async () => {
  if (worker) {
    worker.running = false;
    await workerLoop;
    worker = null;
  }
};

// Through the real SqsSubscriber: parse, traceparent, metadata, save, delete.
const deliver = async (message) => {
  await sendConfigVersion(QUEUE_URL, message);
  const received = await receiveMessage(QUEUE_URL);
  await configVersionUpdatedSubscriber.processMessage(received);

  return received;
};

const inboxRow = (messageId) => inbox.findOne({ messageId });

const settlesAs = async (messageId, status) => {
  await expect
    .poll(async () => (await inboxRow(messageId))?.status, SETTLE)
    .toBe(status);

  return inboxRow(messageId);
};

const versionsOf = (grantCode) => configVersions.find({ grantCode }).toArray();

const publishGood = async (grantCode, version, overrides = {}) => {
  await putConfigFile(cwKey(grantCode, version), workflowDefinition(grantCode));

  return deliver({
    manifest: manifestFor(grantCode, version),
    grant: grantCode,
    version,
    ...overrides,
  });
};

const s3ServiceError = () =>
  new S3FetchError("S3 service error fetching cw.json: SlowDown", {
    statusCode: 503,
    code: "SERVICE_ERROR",
  });

beforeAll(async () => {
  expect(serviceDb.databaseName).toBe(DATABASE);
  expect(configVersionUpdatedSubscriber.queueUrl).toBe(QUEUE_URL);

  await createQueue("cw__sqs__config_version_inbox_test");
  client = await MongoClient.connect(env.MONGO_URI);
  const db = client.db(DATABASE);
  inbox = db.collection("inbox");
  configVersions = db.collection("config_versions");
});

beforeEach(async () => {
  faults.clear();
  await purgeQueue(QUEUE_URL);
  await Promise.all([
    inbox.deleteMany({}),
    configVersions.deleteMany({}),
    client.db(DATABASE).collection("fifo_locks").deleteMany({}),
  ]);
});

afterEach(async () => {
  await stopWorker();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await client?.db(DATABASE).dropDatabase();
  await client?.close();
});

describe("config broker events through the inbox", { timeout: 60000 }, () => {
  it("saves a broker message to the inbox and records no version yet", async () => {
    const grantCode = aGrantCode("save");
    const received = await publishGood(grantCode, "1.2.3");

    const row = await inboxRow(received.MessageId);

    expect(row).toMatchObject({
      source: "CB",
      type: "config-version.updated",
      messageId: received.MessageId,
      segregationRef: grantCode,
      status: "PUBLISHED",
      completionAttempts: 0,
      eventTime: new Date(
        Number(received.Attributes.SentTimestamp),
      ).toISOString(),
    });
    expect(row.traceparent).toMatch(W3C_TRACEPARENT);
    expect(row.event.data).toEqual({
      grantCode,
      version: "1.2.3",
      status: "active",
      s3Bucket: CONFIG_BUCKET,
      manifest: manifestFor(grantCode, "1.2.3"),
    });
    await expect(versionsOf(grantCode)).resolves.toEqual([]);
  });

  it("saves a message SQS delivers twice only once", async () => {
    const grantCode = aGrantCode("dup");
    await sendConfigVersion(QUEUE_URL, {
      manifest: manifestFor(grantCode, "1.0.0"),
      grant: grantCode,
      version: "1.0.0",
    });

    const first = await receiveMessage(QUEUE_URL, { visibilityTimeout: 0 });
    const second = await receiveMessage(QUEUE_URL, { visibilityTimeout: 0 });
    await configVersionUpdatedSubscriber.processMessage(first);
    await configVersionUpdatedSubscriber.processMessage(second);

    expect(second.MessageId).toBe(first.MessageId);
    expect(second.Attributes.ApproximateReceiveCount).toBe("2");
    await expect(inbox.countDocuments({})).resolves.toBe(1);
  });

  it("records a version whose cw.json passes the check, with the message's bucket, and completes", async () => {
    const grantCode = aGrantCode("good");
    const received = await publishGood(grantCode, "1.2.3");

    startWorker();
    const row = await settlesAs(received.MessageId, "COMPLETED");

    expect(row.completionAttempts).toBe(0);
    expect(row.attemptHistory).toEqual([]);
    const [version] = await versionsOf(grantCode);
    expect(version).toMatchObject({
      grantCode,
      version: "1.2.3",
      major: 1,
      minor: 2,
      patch: 3,
      status: "active",
      s3Bucket: CONFIG_BUCKET,
      s3Key: cwKey(grantCode, "1.2.3"),
      fetchStatus: "pending",
    });
  });

  it("records a release whose cw.json has another code under the message's grant, and completes", async () => {
    const grantCode = aGrantCode("aliased");
    await putConfigFile(
      cwKey(grantCode, "1.2.6"),
      workflowDefinition("frps-private-beta"),
    );
    const received = await deliver({
      manifest: manifestFor(grantCode, "1.2.6"),
      grant: grantCode,
      version: "1.2.6",
    });

    startWorker();
    await settlesAs(received.MessageId, "COMPLETED");

    const [version] = await versionsOf(grantCode);
    expect(version).toMatchObject({
      grantCode,
      version: "1.2.6",
      s3Key: cwKey(grantCode, "1.2.6"),
    });
  });

  describe("failures retrying cannot fix go to DEAD_LETTER after one attempt", () => {
    const definitionWith = (grantCode, change) => {
      const definition = workflowDefinition(grantCode);
      change(definition);
      return definition;
    };

    it.each([
      {
        kind: "a manifest without cw.json",
        arrange: async (grantCode) => ({
          manifest: [`${grantCode}/1.0.0/metadata.json`],
        }),
        reason: "Manifest does not contain a cw config file",
      },
      {
        kind: "a cw.json missing from S3",
        arrange: async () => ({}),
        reason: "S3 object not found",
      },
      {
        kind: "a cw.json S3 refuses access to",
        arrange: async (grantCode) => {
          faults.inject(
            "fetch",
            grantCode,
            () =>
              new S3FetchError("S3 access denied: cw.json", {
                statusCode: 403,
                code: "AccessDenied",
              }),
          );
          return {};
        },
        reason: "S3 access denied",
      },
      {
        kind: "a cw.json that is not valid JSON",
        arrange: async (grantCode) => {
          await putConfigFile(cwKey(grantCode, "1.0.0"), "{ not json");
          return {};
        },
        reason: "Invalid JSON in S3 object",
      },
      {
        kind: "a definition with no initial position",
        arrange: async (grantCode) => {
          await putConfigFile(
            cwKey(grantCode, "1.0.0"),
            definitionWith(grantCode, (d) => {
              d.phases = [];
            }),
          );
          return {};
        },
        reason: "has no initial position",
      },
      {
        kind: "a definition with a transition to nowhere",
        arrange: async (grantCode) => {
          await putConfigFile(
            cwKey(grantCode, "1.0.0"),
            definitionWith(grantCode, (d) => {
              d.phases[0].stages[0].statuses[0].transitions.push({
                targetPosition: "PRE_AWARD:REVIEW_APPLICATION:NO_SUCH_STATUS",
              });
            }),
          );
          return {};
        },
        reason: "-> PRE_AWARD:REVIEW_APPLICATION:NO_SUCH_STATUS",
      },
      {
        kind: "a message with no path attribute",
        arrange: async (grantCode) => {
          await putConfigFile(
            cwKey(grantCode, "1.0.0"),
            workflowDefinition(grantCode),
          );
          return { path: undefined };
        },
        reason: "has no bucket (path attribute)",
      },
      {
        kind: "a message with an unknown status",
        arrange: async () => ({ status: "withdrawn" }),
        reason: "invalid status",
      },
    ])("$kind", async ({ arrange, reason }) => {
      const grantCode = aGrantCode("bad");
      const logged = vi.spyOn(logger, "error");
      const overrides = await arrange(grantCode);
      const received = await deliver({
        manifest: manifestFor(grantCode, "1.0.0"),
        grant: grantCode,
        version: "1.0.0",
        ...overrides,
      });

      startWorker();
      const row = await settlesAs(received.MessageId, "DEAD_LETTER");

      expect(row.completionAttempts).toBe(1);
      expect(row.attemptHistory).toHaveLength(1);
      expect(row.retryable).toBe(false);
      expect(row.lastError.message).toContain(reason);
      await expect(versionsOf(grantCode)).resolves.toEqual([]);
      expect(logged).toHaveBeenCalledWith(
        expect.objectContaining({
          event: expect.objectContaining({
            action: "config-version-rejected",
            reference: `${grantCode}@1.0.0`,
            reason: expect.stringContaining(reason),
          }),
        }),
        expect.stringContaining(`Config version ${grantCode}@1.0.0 rejected`),
      );
    });

    it("dead-letters a message with no path attribute and reads no bucket of its own", async () => {
      const grantCode = aGrantCode("nopath");
      await putConfigFile(
        cwKey(grantCode, "1.0.0"),
        workflowDefinition(grantCode),
      );
      const fetched = vi.fn();
      faults.inject("fetch", grantCode, () => {
        fetched();
        return new Error("fetchConfigFile must not be called");
      });

      const received = await deliver({
        manifest: manifestFor(grantCode, "1.0.0"),
        grant: grantCode,
        version: "1.0.0",
        path: undefined,
      });
      expect(
        (await inboxRow(received.MessageId)).event.data.s3Bucket,
      ).toBeNull();

      startWorker();
      const row = await settlesAs(received.MessageId, "DEAD_LETTER");

      expect(fetched).not.toHaveBeenCalled();
      expect(row.completionAttempts).toBe(1);
      expect(row.lastError.message).toContain("has no bucket");
      await expect(versionsOf(grantCode)).resolves.toEqual([]);
    });

    it("saves a message with no grant attribute under unknown-grant and dead-letters it", async () => {
      const received = await deliver({
        manifest: ["somewhere/1.0.0/cw/cw.json"],
        grant: undefined,
        version: "1.0.0",
      });

      expect(await inboxRow(received.MessageId)).toMatchObject({
        segregationRef: "unknown-grant",
        status: "PUBLISHED",
      });

      startWorker();
      const row = await settlesAs(received.MessageId, "DEAD_LETTER");

      expect(row.completionAttempts).toBe(1);
      expect(row.lastError.message).toContain(
        "missing required fields: grantCode=null",
      );
      await expect(configVersions.countDocuments({})).resolves.toBe(0);
    });
  });

  describe("transient failures are retried", () => {
    it("retries a transient S3 error and completes once S3 recovers", async () => {
      const grantCode = aGrantCode("s3blip");
      faults.inject("fetch", grantCode, s3ServiceError, 2);
      const received = await publishGood(grantCode, "1.0.0");

      startWorker();
      const row = await settlesAs(received.MessageId, "COMPLETED");

      expect(row.completionAttempts).toBe(2);
      expect(row.attemptHistory.map((a) => a.message)).toEqual([
        "S3 service error fetching cw.json: SlowDown",
        "S3 service error fetching cw.json: SlowDown",
      ]);
      await expect(versionsOf(grantCode)).resolves.toHaveLength(1);
    });

    it("retries a database error up to INBOX_MAX_RETRIES, then dead-letters", async () => {
      const grantCode = aGrantCode("dbdown");
      faults.inject(
        "upsert",
        grantCode,
        () => new MongoNetworkError("connection pool was cleared"),
      );
      const received = await publishGood(grantCode, "1.0.0");

      startWorker();
      const row = await settlesAs(received.MessageId, "DEAD_LETTER");

      expect(MAX_RETRIES).toBe(5);
      expect(row.completionAttempts).toBe(MAX_RETRIES);
      expect(row.attemptHistory).toHaveLength(MAX_RETRIES);
      expect(new Set(row.attemptHistory.map((a) => a.name))).toEqual(
        new Set(["MongoNetworkError"]),
      );
      expect(row.retryable).toBe(true);
      await expect(versionsOf(grantCode)).resolves.toEqual([]);
    });
  });

  it("completes a dead-lettered event once the cause is fixed and it is redriven", async () => {
    const grantCode = aGrantCode("redrive");
    const received = await deliver({
      manifest: manifestFor(grantCode, "2.0.0"),
      grant: grantCode,
      version: "2.0.0",
    });

    startWorker();
    const dead = await settlesAs(received.MessageId, "DEAD_LETTER");
    expect(dead.lastError.message).toContain("S3 object not found");
    await expect(versionsOf(grantCode)).resolves.toEqual([]);

    await putConfigFile(
      cwKey(grantCode, "2.0.0"),
      workflowDefinition(grantCode),
    );
    await expect(
      redriveById(dead._id.toHexString(), { by: "operator@defra.gov.uk" }),
    ).resolves.toBe(true);

    const row = await settlesAs(received.MessageId, "COMPLETED");

    expect(row.retryable).toBe(true);
    expect(row.lastRedrive.by).toBe("operator@defra.gov.uk");
    const [version] = await versionsOf(grantCode);
    expect(version).toMatchObject({
      version: "2.0.0",
      s3Bucket: CONFIG_BUCKET,
    });
  });

  describe("ordering", () => {
    it("applies one grant's events in the order the broker sent them, whatever order they were saved in", async () => {
      const grantCode = aGrantCode("order");
      await putConfigFile(
        cwKey(grantCode, "1.1.0"),
        workflowDefinition(grantCode),
      );
      const message = (status) => ({
        manifest: manifestFor(grantCode, "1.1.0"),
        grant: grantCode,
        version: "1.1.0",
        status,
      });

      await sendConfigVersion(QUEUE_URL, message("draft"));
      await new Promise((resolve) => setTimeout(resolve, 50));
      await sendConfigVersion(QUEUE_URL, message("active"));
      const received = [
        await receiveMessage(QUEUE_URL),
        await receiveMessage(QUEUE_URL),
      ];
      const withStatus = (status) =>
        received.find((m) => m.MessageAttributes.status.StringValue === status);
      const draft = withStatus("draft");
      const active = withStatus("active");
      expect(Number(draft.Attributes.SentTimestamp)).toBeLessThan(
        Number(active.Attributes.SentTimestamp),
      );

      await configVersionUpdatedSubscriber.processMessage(active);
      await configVersionUpdatedSubscriber.processMessage(draft);

      startWorker();
      const draftRow = await settlesAs(draft.MessageId, "COMPLETED");
      const activeRow = await settlesAs(active.MessageId, "COMPLETED");

      expect(draftRow.completionDate <= activeRow.completionDate).toBe(true);
      const [version] = await versionsOf(grantCode);
      expect(version.status).toBe("active");
    });

    it("does not hold up other grants while one grant's event is being retried", async () => {
      const stuck = aGrantCode("stuck");
      const other = aGrantCode("other");
      faults.inject("fetch", stuck, s3ServiceError);

      const stuckMessage = await publishGood(stuck, "1.0.0");
      const otherMessage = await publishGood(other, "1.0.0");

      startWorker();
      const otherRow = await settlesAs(otherMessage.MessageId, "COMPLETED");
      const stuckRow = await settlesAs(stuckMessage.MessageId, "DEAD_LETTER");

      expect(stuckRow.eventTime <= otherRow.eventTime).toBe(true);
      expect(stuckRow.completionAttempts).toBe(MAX_RETRIES);
      expect(otherRow.completionDate < stuckRow.attemptHistory.at(-1).at).toBe(
        true,
      );
      await expect(versionsOf(other)).resolves.toHaveLength(1);
      await expect(versionsOf(stuck)).resolves.toEqual([]);
    });
  });
});
