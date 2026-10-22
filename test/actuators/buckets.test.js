import { MongoClient, ObjectId } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  listBuckets,
  queryBucket,
  readTimeline,
  seedCaseReaderToken,
} from "../helpers/actuators.js";
import { OPERATOR_ID, OPERATOR_NAME } from "../helpers/operator.js";
import { CASE_READER_CLIENT, SERVICE_TOKEN } from "../helpers/service-token.js";

let client;
let db;
let cases;
let outbox;

const NOW = new Date("2026-10-09T12:00:00.000Z");

const minutesAgo = (minutes) => new Date(NOW.getTime() - minutes * 60_000);

const aCase = (caseRef, overrides = {}) => ({
  _id: new ObjectId(),
  caseRef,
  workflowCode: "example-workflow",
  currentPhase: "PRE_AWARD",
  currentStage: "REVIEW",
  currentStatus: "NEW",
  closed: false,
  closedAt: null,
  createdAt: NOW,
  payload: { identifiers: { sbi: "100000001" } },
  comments: [],
  timeline: [],
  refs: [`ref:${caseRef}`, "sbi:100000001"],
  ...overrides,
});

// A held far-future claim keeps the poller off the fixtures.
const anOutboxRow = (overrides = {}) => ({
  _id: new ObjectId(),
  target: "arn:aws:sns:eu-west-2:000000000000:some-topic",
  segregationRef: "abc-123-example-workflow",
  status: "COMPLETED",
  publicationDate: NOW,
  completionDate: NOW.toISOString(),
  claimedBy: "test-holder",
  claimExpiresAt: new Date("2099-01-01T00:00:00.000Z"),
  event: { id: "0b7c1d1e-0000-4000-8000-000000000001" },
  eventType: "CaseStatusUpdated",
  refs: [
    "ref:abc-123",
    "case:example-workflow:abc-123",
    "id:0b7c1d1e-0000-4000-8000-000000000001",
  ],
  ...overrides,
});

const titlesOf = (response) => response.payload.rows.map(({ title }) => title);

const auditRows = () =>
  outbox.find({ segregationRef: "admin-query-bucket" }).toArray();

const bodyOf = (error) => {
  const payload = error.data?.payload;

  return Buffer.isBuffer(payload) ? JSON.parse(payload.toString()) : payload;
};

const refusalOf = async (request) => bodyOf(await request.catch((e) => e));

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  db = client.db();
  cases = db.collection("cases");
  outbox = db.collection("outbox");
  await seedCaseReaderToken(db);
});

afterAll(async () => {
  await client?.close(true);
});

describe("GET /actuators/buckets", () => {
  it("lists this service's four buckets in their order", async () => {
    const response = await listBuckets();

    expect(response.payload.buckets.map(({ id }) => id)).toEqual([
      "cw.outbox",
      "cw.inbox",
      "cw.cases",
    ]);
  });

  it("reads the workflows of the stored cases, and offers no status", async () => {
    await cases.insertMany([
      aCase("abc-1"),
      aCase("abc-2", { workflowCode: "other-workflow", currentStatus: "DONE" }),
    ]);

    const { payload } = await listBuckets();
    const facts = payload.buckets.find(({ id }) => id === "cw.cases").facts;
    const valuesOf = (name) =>
      facts.find((fact) => fact.name === name).values.map(({ value }) => value);

    expect(valuesOf("workflowCode")).toEqual([
      "example-workflow",
      "other-workflow",
    ]);
    expect(facts.map(({ name }) => name)).not.toContain("currentStatus");
  });

  it("describes the version of a case as a fact within its workflow", async () => {
    const { payload } = await listBuckets();
    const { facts, indexes } = payload.buckets.find(
      ({ id }) => id === "cw.cases",
    );

    expect(facts.find(({ name }) => name === "currentConfigVersion")).toEqual({
      name: "currentConfigVersion",
      param: "version",
      label: "Version",
      values: null,
      toggle: null,
      within: "workflowCode",
    });
    expect(indexes).toContainEqual(["workflowCode", "currentConfigVersion"]);
  });

  it("answers 403 to a client other than fg-gas-backend", async () => {
    await expect(
      listBuckets({ authorization: `Bearer ${SERVICE_TOKEN}` }),
    ).rejects.toThrow("Response Error: 403 Forbidden");
  });
});

describe("POST /actuators/buckets/{bucketId}/query, cw.cases", () => {
  it("pages newest first from a cursor, each row once", async () => {
    await cases.insertMany(
      Array.from({ length: 45 }, (_, n) =>
        aCase(`abc-${n}`, { createdAt: minutesAgo(n) }),
      ),
    );

    const first = await queryBucket("cw.cases", {});
    const second = await queryBucket("cw.cases", {
      cursor: first.payload.page.next,
    });
    const third = await queryBucket("cw.cases", {
      cursor: second.payload.page.next,
    });

    expect(first.payload.plan).toMatchObject({
      kind: "exact",
      index: ["createdAt", "_id"],
    });
    expect([
      ...titlesOf(first),
      ...titlesOf(second),
      ...titlesOf(third),
    ]).toEqual(Array.from({ length: 45 }, (_, n) => `abc-${n}`));
    expect(third.payload.page).toMatchObject({ next: null, complete: true });
  });

  it("reads a workflow exactly", async () => {
    await cases.insertMany([
      aCase("abc-1"),
      aCase("abc-2", { closed: true, currentStatus: "DONE" }),
      aCase("abc-3", { workflowCode: "other-workflow" }),
    ]);

    const { payload } = await queryBucket("cw.cases", {
      where: { workflowCode: "example-workflow" },
    });

    expect(payload.plan).toMatchObject({
      kind: "exact",
      index: ["workflowCode", "createdAt", "_id"],
    });
    expect(payload.rows.map(({ title }) => title)).toEqual(["abc-2", "abc-1"]);
  });

  it("lists the cases on one version of a workflow exactly, showing the version", async () => {
    await cases.insertMany([
      aCase("abc-1", { currentConfigVersion: "1.2.0" }),
      aCase("abc-2", { currentConfigVersion: "1.1.0" }),
      aCase("abc-3", {
        workflowCode: "other-workflow",
        currentConfigVersion: "1.2.0",
      }),
    ]);

    const { payload } = await queryBucket("cw.cases", {
      where: {
        workflowCode: "example-workflow",
        currentConfigVersion: "1.2.0",
      },
    });
    const [row] = await auditRows();

    expect(payload.plan).toMatchObject({
      kind: "exact",
      index: ["workflowCode", "currentConfigVersion", "createdAt", "_id"],
      bound: ["workflowCode", "currentConfigVersion"],
      residual: [],
    });
    expect(
      payload.rows.map(({ title, cells }) => [title, cells.workflowCode]),
    ).toEqual([["abc-1", "example-workflow@1.2.0"]]);
    expect(payload.rows[0].link).toMatchObject({
      workflowCode: "example-workflow",
    });
    expect(row.event.audit.details.facts).toEqual([
      "workflowCode",
      "currentConfigVersion",
    ]);
    expect(JSON.stringify(row.event.audit.details)).not.toContain("1.2.0");
  });

  it("finds every member of a series by any member's reference", async () => {
    const refs = ["ref:abc-1", "ref:abc-2", "sbi:100000001"];
    await cases.insertMany([
      aCase("abc-1", { refs, createdAt: minutesAgo(2) }),
      aCase("abc-2", { refs, createdAt: minutesAgo(1) }),
      aCase("abc-9"),
    ]);

    const { payload } = await queryBucket("cw.cases", { ref: "ref:ABC-1" });

    expect(payload.plan).toMatchObject({
      kind: "exact",
      index: ["refs", "createdAt", "_id"],
      bound: ["ref"],
    });
    expect(payload.rows.map(({ title }) => title)).toEqual(["abc-2", "abc-1"]);
    expect(payload.rows[0]).not.toHaveProperty("tags");
  });

  it.each([
    "closed",
    "replaced",
    "currentStatus",
    "currentPhase",
    "assignedUserId",
  ])("refuses %s, which is no fact of the list", async (fact) => {
    const error = await queryBucket("cw.cases", {
      where: { [fact]: "x" },
    }).catch((e) => e);

    expect(bodyOf(error)).toMatchObject({ reason: "UNKNOWN_FACT" });
  });

  it("never returns the payload", async () => {
    await cases.insertOne(aCase("abc-1"));

    const { payload } = await queryBucket("cw.cases", {});

    expect(JSON.stringify(payload)).not.toContain("identifiers");
  });
});

describe("POST /actuators/buckets/{bucketId}/query, the outbox buckets", () => {
  it("lists audit rows with the messages only when they are asked for", async () => {
    await outbox.insertMany([
      anOutboxRow(),
      anOutboxRow({
        eventType: "Audit",
        refs: [],
      }),
    ]);

    const hiding = await queryBucket("cw.outbox", {});
    const showing = await queryBucket("cw.outbox", {
      show: ["eventType"],
    });

    expect(hiding.payload.rows).toEqual([
      expect.objectContaining({
        title: "CaseStatusUpdated",
        subtitle: "0b7c1d1e-0000-4000-8000-000000000001",
        link: expect.objectContaining({
          kind: "event",
          service: "caseworking",
          box: "outbox",
        }),
      }),
    ]);
    expect(hiding.payload.plan).toMatchObject({
      kind: "exact",
      index: ["eventType", "publicationDate", "_id"],
      filled: ["eventType"],
      scans: 3,
    });
    expect(showing.payload.plan).toMatchObject({
      kind: "exact",
      filled: ["eventType"],
      scans: 4,
    });
    expect(titlesOf(showing).toSorted()).toEqual([
      "Audit",
      "CaseStatusUpdated",
    ]);
  });

  it("reads one event type on one scan of the key it leads", async () => {
    await outbox.insertOne(anOutboxRow());

    const { payload } = await queryBucket("cw.outbox", {
      where: { eventType: "CaseStatusUpdated" },
    });

    expect(payload.plan).toMatchObject({
      kind: "exact",
      index: ["eventType", "publicationDate", "_id"],
      bound: ["eventType"],
      scans: 1,
    });
    expect(payload.rows).toHaveLength(1);
  });
});

describe("POST /actuators/timeline", () => {
  it("answers the ref's rows from each timeline bucket apart, and no record bucket", async () => {
    await outbox.insertMany([
      anOutboxRow(),
      anOutboxRow({ refs: ["ref:other-1"] }),
    ]);

    const { payload } = await readTimeline("ref:ABC-123");

    expect(payload.buckets.map(({ id, more }) => [id, more])).toEqual([
      ["cw.outbox", false],
      ["cw.inbox", false],
    ]);
    expect(payload.buckets[0].rows).toEqual([
      expect.objectContaining({ title: "CaseStatusUpdated" }),
    ]);
    expect(payload.buckets[1].rows).toEqual([]);
  });

  it("answers by a case's workflow and reference, leaving out the same reference in another workflow", async () => {
    await outbox.insertMany([
      anOutboxRow(),
      anOutboxRow({
        segregationRef: "abc-123-other-workflow",
        refs: ["ref:abc-123", "case:other-workflow:abc-123"],
      }),
    ]);

    const { payload } = await readTimeline("case:example-workflow:abc-123");

    expect(payload.buckets[0].rows).toEqual([
      expect.objectContaining({ title: "CaseStatusUpdated" }),
    ]);
    expect(payload.buckets[0].rows).toHaveLength(1);
  });
});

describe("POST /actuators/buckets/{bucketId}/query, refusals", () => {
  it.each([
    ["an undeclared fact", { where: { colour: "x" } }, "UNKNOWN_FACT", 400],
    [
      "a payload path",
      { where: { "payload.identifiers.sbi": "1" } },
      "UNKNOWN_FACT",
      400,
    ],
    ["a free-text search", { q: "abc" }, "INVALID_REQUEST", 400],
    ["an undeclared ref kind", { ref: "nokind:1" }, "UNKNOWN_REF_KIND", 400],
    ["an unreadable cursor", { cursor: "x" }, "INVALID_CURSOR", 400],
    [
      "a grouping the bucket does not declare",
      { groupBy: ["closed"] },
      "UNKNOWN_GROUPING",
      400,
    ],
    [
      "from after to",
      { from: "2026-10-09T00:00:00Z", to: "2026-10-08T00:00:00Z" },
      "INVALID_RANGE",
      400,
    ],
  ])("refuses %s", async (_name, body, reason, statusCode) => {
    expect(await refusalOf(queryBucket("cw.cases", body))).toMatchObject({
      reason,
      statusCode,
    });
  });

  it.each(["cw.nothing", "gas.applications", "CW.Cases"])(
    "answers 404 UNKNOWN_BUCKET for %s",
    async (bucketId) => {
      expect(await refusalOf(queryBucket(bucketId, {}))).toEqual({
        statusCode: 404,
        error: "Not Found",
        message: "No such bucket",
        reason: "UNKNOWN_BUCKET",
      });
    },
  );

  it("writes no audit row for a refused query", async () => {
    await expect(
      queryBucket("cw.cases", { where: { colour: "x" } }),
    ).rejects.toThrow();

    expect(await auditRows()).toEqual([]);
  });
});

describe("POST /actuators/buckets/{bucketId}/query, access and audit", () => {
  it("answers 403 to a client other than fg-gas-backend", async () => {
    await expect(
      queryBucket("cw.cases", {}, { authorization: `Bearer ${SERVICE_TOKEN}` }),
    ).rejects.toThrow("Response Error: 403 Forbidden");
  });

  it("answers 401 with no token", async () => {
    await expect(
      queryBucket("cw.cases", {}, { authorization: null }),
    ).rejects.toThrow("Response Error: 401 Unauthorized");
  });

  it("refuses a query that names no operator", async () => {
    expect(
      await refusalOf(queryBucket("cw.cases", {}, { "x-actor-id": "" })),
    ).toMatchObject({ reason: "INVALID_REQUEST", statusCode: 400 });
  });

  it("commits one stamped QUERY_BUCKET row naming the operator, with 0706", async () => {
    await cases.insertOne(aCase("abc-1"));

    await queryBucket(
      "cw.cases",
      {
        where: { workflowCode: "example-workflow" },
        ref: "ref:abc-1",
      },
      { "x-search-repeat": "1" },
    );

    const rows = await auditRows();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      eventType: "Audit",
    });
    expect(rows[0].event).toMatchObject({
      user: OPERATOR_ID,
      security: { pmccode: "0706" },
      audit: {
        entities: [
          { entity: "BUCKET", action: "QUERY_BUCKET", entityid: "cw.cases" },
        ],
        status: "SUCCESS",
        details: {
          security: { actor: { id: OPERATOR_ID, name: OPERATOR_NAME } },
          caller: CASE_READER_CLIENT,
          facts: ["workflowCode"],
          refKind: "ref",
          page: "first",
          plan: "bounded",
          resultCount: 1,
          repeat: true,
        },
      },
    });
    expect(JSON.stringify(rows[0].event)).not.toContain("abc-1");
    expect(JSON.stringify(rows[0].event)).not.toContain("example-workflow");
  });

  it("writes no audit row for a bucket that is not audited", async () => {
    await queryBucket("cw.outbox", {});

    expect(await auditRows()).toEqual([]);
  });
});
