import { MongoClient, ObjectId } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seriesMembersCursor } from "../../src/cases/repositories/case/admin-case-query.js";
import {
  caseExistence,
  editInboxPayload,
  getInboxEvent,
  purgeInboxEvent,
  redriveInboxEvent,
  seedCaseReaderToken,
  viewCaseData,
} from "../helpers/actuators.js";
import { CASE_READER_CLIENT, SERVICE_TOKEN } from "../helpers/service-token.js";
import {
  OPERATOR_ID,
  OPERATOR_NAME,
  operatorHeaders,
} from "../helpers/operator.js";

let client;
let db;
let cases;

const CREATED_AT = new Date("2026-06-16T10:00:00.000Z");
const FAR_FUTURE = new Date("2099-01-01T00:00:00.000Z");

// Two differently shaped workflow payloads, each returned only whole.
const WMP_PAYLOAD = {
  answers: { parcels: [{ id: "SX0679-9238", hectares: 2.5 }] },
  identifiers: { sbi: "106284736" },
};
const FRPS_PAYLOAD = {
  applicant: { business: { name: "Farm" } },
  actionApplications: [{ code: "CSAM1", appliedFor: { quantity: 20.23 } }],
};

const rejectionOf = async (promise) => {
  try {
    await promise;
  } catch (error) {
    return error;
  }
};

const aCase = (overrides = {}) => ({
  _id: new ObjectId(),
  caseRef: "case-1",
  workflowCode: "frps",
  currentPhase: "PRE_AWARD",
  currentStage: "REVIEW",
  currentStatus: "NEW",
  closed: true,
  closedAt: new Date("2026-06-20T00:00:00.000Z"),
  createdAt: CREATED_AT,
  originalConfigVersion: "1.0.0",
  currentConfigVersion: "1.2.0",
  assignedUserId: "user-1",
  payload: FRPS_PAYLOAD,
  supplementaryData: { agreements: [{ ref: "AG-1" }] },
  phases: [],
  comments: [{ ref: "n1", text: "caseworker note", createdBy: "user-1" }],
  timeline: [{ eventType: "CASE_CREATED", createdAt: CREATED_AT }],
  ...overrides,
});

// Written before notes, the timeline and the config version split existed.
const aLegacyCase = () => {
  const {
    comments,
    timeline,
    originalConfigVersion,
    currentConfigVersion,
    ...legacy
  } = aCase({ configVersion: "0.0.0" });

  return legacy;
};

const aSeries = (workflowCode, caseRefs) => ({
  workflowCode,
  caseRefs,
  latestCaseRef: caseRefs.at(-1),
  latestCaseId: new ObjectId().toHexString(),
  createdAt: CREATED_AT.toISOString(),
  updatedAt: CREATED_AT.toISOString(),
});

const bsonSizeOf = async (caseRef) => {
  const [{ size }] = await cases
    .aggregate([
      { $match: { caseRef } },
      { $project: { size: { $bsonSize: "$$ROOT" } } },
    ])
    .toArray();

  return size;
};

const auditRows = (segregationRef) =>
  db.collection("outbox").find({ segregationRef }).toArray();

const errorBody = (error) => {
  const payload = error.data?.payload;

  return Buffer.isBuffer(payload) ? JSON.parse(payload.toString()) : payload;
};

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  db = client.db();
  cases = db.collection("cases");
  await seedCaseReaderToken(db);
});

afterAll(async () => {
  await client?.close(true);
});

describe("GET /actuators/cases/{workflowCode}/{caseRef}", () => {
  it("answers the summary and the whole document's stored size", async () => {
    await cases.insertOne(aCase());
    await db.collection("case_series").insertOne({
      workflowCode: "frps",
      caseRefs: ["case-0", "case-1"],
      latestCaseRef: "case-1",
      latestCaseId: new ObjectId().toHexString(),
      createdAt: CREATED_AT.toISOString(),
      updatedAt: CREATED_AT.toISOString(),
    });

    const { payload } = await viewCaseData("frps", "case-1");

    expect(payload).toEqual({
      case: {
        ref: { caseRef: "case-1", workflowCode: "frps" },
        position: { phase: "PRE_AWARD", stage: "REVIEW", status: "NEW" },
        closed: true,
        closedAt: "2026-06-20T00:00:00.000Z",
        createdAt: "2026-06-16T10:00:00.000Z",
        originalConfigVersion: "1.0.0",
        currentConfigVersion: "1.2.0",
        series: {
          latestRef: "case-1",
          refs: ["case-0", "case-1"],
          members: [
            {
              caseRef: "case-0",
              position: { phase: null, stage: null, status: null },
              createdAt: null,
              closedAt: null,
            },
            {
              caseRef: "case-1",
              position: { phase: "PRE_AWARD", stage: "REVIEW", status: "NEW" },
              createdAt: "2026-06-16T10:00:00.000Z",
              closedAt: "2026-06-20T00:00:00.000Z",
            },
          ],
        },
      },
      storedBytes: await bsonSizeOf("case-1"),
    });
  });

  it("gives each series member's position and dates, oldest first", async () => {
    await cases.insertMany([
      aCase({
        caseRef: "case-2",
        closed: false,
        closedAt: null,
        createdAt: new Date("2026-06-21T00:00:00.000Z"),
      }),
      aCase(),
      aCase({
        caseRef: "case-0",
        currentStage: "AWARD",
        currentStatus: "WITHDRAWN",
        closedAt: new Date("2026-06-10T00:00:00.000Z"),
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
      }),
      aCase({ caseRef: "case-0", workflowCode: "woodland" }),
    ]);
    await db
      .collection("case_series")
      .insertMany([
        aSeries("frps", ["case-0", "case-1", "case-2"]),
        aSeries("woodland", ["case-0"]),
      ]);

    const { series } = (await viewCaseData("frps", "case-1")).payload.case;

    expect(series.members).toEqual([
      {
        caseRef: "case-0",
        position: { phase: "PRE_AWARD", stage: "AWARD", status: "WITHDRAWN" },
        createdAt: "2026-06-01T00:00:00.000Z",
        closedAt: "2026-06-10T00:00:00.000Z",
      },
      {
        caseRef: "case-1",
        position: { phase: "PRE_AWARD", stage: "REVIEW", status: "NEW" },
        createdAt: "2026-06-16T10:00:00.000Z",
        closedAt: "2026-06-20T00:00:00.000Z",
      },
      {
        caseRef: "case-2",
        position: { phase: "PRE_AWARD", stage: "REVIEW", status: "NEW" },
        createdAt: "2026-06-21T00:00:00.000Z",
        closedAt: null,
      },
    ]);
    expect(JSON.stringify(series)).not.toMatch(/opaque|Farm|caseworker note/);
  });

  it("gives a series of one no members", async () => {
    await cases.insertOne(
      aCase({ caseRef: "case-0", workflowCode: "woodland" }),
    );
    await db
      .collection("case_series")
      .insertOne(aSeries("woodland", ["case-0"]));

    const { series } = (await viewCaseData("woodland", "case-0")).payload.case;

    expect(series).toEqual({
      latestRef: "case-0",
      refs: ["case-0"],
      members: [],
    });
  });

  it("reads the members in one read on the unique key", async () => {
    await cases.insertMany(
      ["case-1", "case-2", "case-3", "case-4"].flatMap((caseRef) => [
        aCase({ caseRef }),
        aCase({ caseRef, workflowCode: "woodland" }),
      ]),
    );
    const caseRefs = ["case-1", "case-3", "case-5"];
    const cursor = seriesMembersCursor(
      cases,
      { workflowCode: "frps", caseRefs },
      { maxTimeMS: 5000 },
    );
    const { queryPlanner, executionStats } =
      await cursor.explain("executionStats");
    const stagesOf = (plan) => [
      plan,
      ...(plan.inputStage ? stagesOf(plan.inputStage) : []),
      ...(plan.inputStages ?? []).flatMap(stagesOf),
    ];

    expect(
      stagesOf(queryPlanner.winningPlan)
        .filter(({ stage }) => stage === "IXSCAN")
        .map(({ keyPattern }) => keyPattern),
    ).toEqual([{ workflowCode: 1, caseRef: 1 }]);
    expect(executionStats.nReturned).toBe(2);
    // Each point of the $in reads at most its key and the next one.
    expect(executionStats.totalKeysExamined).toBeLessThanOrEqual(
      2 * caseRefs.length,
    );
    expect(executionStats.totalDocsExamined).toBe(executionStats.nReturned);
  });

  it("adds the stored document without the caseworker notes", async () => {
    const stored = aCase({ payload: WMP_PAYLOAD });
    await cases.insertOne(stored);

    const { payload } = await viewCaseData("frps", "case-1", {
      include: "document",
    });

    expect(payload.document).not.toHaveProperty("comments");
    expect(payload.document).not.toHaveProperty("storedBytes");
    expect(payload.document).toMatchObject({
      _id: stored._id.toHexString(),
      payload: WMP_PAYLOAD,
      supplementaryData: stored.supplementaryData,
      assignedUserId: "user-1",
      createdAt: "2026-06-16T10:00:00.000Z",
    });
    expect(payload.storedBytes).toBe(await bsonSizeOf("case-1"));
    expect(JSON.stringify(payload)).not.toContain("caseworker note");
  });

  it("reads a legacy document with no notes, timeline or config versions", async () => {
    await cases.insertOne(aLegacyCase());

    const { payload } = await viewCaseData("frps", "case-1", {
      include: "document",
    });

    expect(payload.case).toMatchObject({
      originalConfigVersion: "0.0.0",
      currentConfigVersion: "0.0.0",
      series: null,
    });
    expect(payload.document).not.toHaveProperty("comments");
  });

  it.each([
    ["a current case", aCase],
    ["a legacy case", aLegacyCase],
  ])("writes nothing to %s", async (_name, aStoredCase) => {
    await cases.insertOne(aStoredCase());
    const before = await cases.findOne({ caseRef: "case-1" });

    await viewCaseData("frps", "case-1", { include: "document" });
    await viewCaseData("frps", "case-1");

    expect(await cases.findOne({ caseRef: "case-1" })).toEqual(before);
  });

  it("commits one VIEW_CASE_DATA row naming the operator, with 0706", async () => {
    await cases.insertOne(aCase());

    await viewCaseData("frps", "case-1", { include: "document" });

    const rows = await auditRows("admin-view-case");

    expect(rows).toHaveLength(1);
    expect(rows[0].event).toMatchObject({
      user: OPERATOR_ID,
      security: { pmccode: "0706" },
      audit: {
        entities: [
          { entity: "CASE", action: "VIEW_CASE_DATA", entityid: "case-1" },
        ],
        status: "SUCCESS",
        details: {
          security: { actor: { id: OPERATOR_ID, name: OPERATOR_NAME } },
          caller: CASE_READER_CLIENT,
          workflowCode: "frps",
          include: "document",
        },
      },
    });
    expect(rows[0].event.audit).not.toHaveProperty("accounts.sbi");
    expect(JSON.stringify(rows[0].event)).not.toMatch(/106284736|Farm/);
  });

  it("answers 404 CASE_NOT_FOUND and audits a FAILURE", async () => {
    const error = await rejectionOf(viewCaseData("frps", "no-such-case"));

    expect(error.message).toBe("Response Error: 404 Not Found");
    expect(errorBody(error)).toMatchObject({
      message: "Case not found",
      reason: "CASE_NOT_FOUND",
    });

    const [row] = await auditRows("admin-view-case");

    expect(row.event).toMatchObject({
      user: OPERATOR_ID,
      audit: { status: "FAILURE", details: { include: "none" } },
    });
  });

  it("answers 403 to a client other than fg-gas-backend", async () => {
    await cases.insertOne(aCase());

    await expect(
      viewCaseData("frps", "case-1", undefined, {
        authorization: `Bearer ${SERVICE_TOKEN}`,
      }),
    ).rejects.toThrow("Response Error: 403 Forbidden");
  });

  it("answers 400 without the operator's name", async () => {
    await expect(
      viewCaseData("frps", "case-1", undefined, { "x-actor": "" }),
    ).rejects.toThrow("Response Error: 400 Bad Request");
  });

  it("answers 401 with no token", async () => {
    await expect(
      viewCaseData("frps", "case-1", undefined, { authorization: null }),
    ).rejects.toThrow("Response Error: 401 Unauthorized");
  });
});

describe("GET /actuators/cases/{workflowCode}/{caseRef}/existence", () => {
  it("says yes for a case and no for none, with no audit row", async () => {
    await cases.insertOne(aCase());

    expect((await caseExistence("frps", "case-1")).payload).toEqual({
      exists: true,
    });
    expect((await caseExistence("woodland", "case-1")).payload).toEqual({
      exists: false,
    });
    expect(await db.collection("outbox").countDocuments()).toBe(0);
  });

  it("answers 403 to a client other than fg-gas-backend", async () => {
    await expect(
      caseExistence("frps", "case-1", {
        authorization: `Bearer ${SERVICE_TOKEN}`,
      }),
    ).rejects.toThrow("Response Error: 403 Forbidden");
  });

  it("answers 401 with no token", async () => {
    await expect(
      caseExistence("frps", "case-1", { authorization: null }),
    ).rejects.toThrow("Response Error: 401 Unauthorized");
  });
});

describe("the event detail's case", () => {
  const anInboxEvent = (data, overrides = {}) => ({
    _id: new ObjectId(),
    messageId: `msg-${new ObjectId().toHexString()}`,
    type: "cloud.defra.prd.fg-gas-backend.case.create.new",
    source: "GAS",
    segregationRef: `EVENT-CASE-${new ObjectId().toHexString()}`,
    status: "DEAD_LETTER",
    completionAttempts: 5,
    eventTime: "2026-06-16T10:00:00.000Z",
    publicationDate: "2026-06-16T10:00:01.000Z",
    claimedBy: "test-holder",
    claimExpiresAt: FAR_FUTURE,
    event: { id: "evt-1", data },
    ...overrides,
  });

  it.each([
    [true, () => cases.insertOne(aCase())],
    [false, async () => {}],
  ])("says whether the named case exists: %s", async (exists, seed) => {
    await seed();
    const doc = anInboxEvent({
      caseRef: "case-1",
      workflowCode: "frps",
      payload: { caseRef: "elsewhere" },
    });
    await db.collection("inbox").insertOne(doc);

    const { payload } = await getInboxEvent(doc._id.toHexString());

    expect(payload.case).toEqual({
      workflowCode: "frps",
      caseRef: "case-1",
      exists,
    });
  });

  it("is null for an event that names no case", async () => {
    const doc = anInboxEvent({ grantCode: "frps" });
    await db.collection("inbox").insertOne(doc);

    expect(
      (await getInboxEvent(doc._id.toHexString())).payload.case,
    ).toBeNull();
  });
});

describe("the operator on existing actuator audits", () => {
  const EDIT_TYPE = "cloud.defra.test.fg-gas-backend.edit.test.unknown";

  const aDeadInboxRow = async (overrides = {}) => {
    const id = new ObjectId();
    await db.collection("inbox").insertOne({
      _id: id,
      messageId: `msg-${id.toHexString()}`,
      type: "cloud.defra.prd.fg-gas-backend.case.create.new",
      source: "GAS",
      segregationRef: `OPERATOR-${id.toHexString()}`,
      status: "DEAD_LETTER",
      completionAttempts: 5,
      eventTime: "2026-06-16T10:00:00.000Z",
      claimedBy: null,
      claimExpiresAt: null,
      event: { id: "evt-1", data: {} },
      ...overrides,
    });

    return id.toHexString();
  };

  const auditRowFor = (id, action) =>
    db.collection("outbox").findOne({
      "event.audit.entities.entityid": id,
      "event.audit.entities.action": action,
    });

  const withActorId = { "x-actor-id": operatorHeaders["x-actor-id"] };

  it("names the operator's id in a redrive's audit row", async () => {
    const id = await aDeadInboxRow();

    await redriveInboxEvent(
      id,
      { by: OPERATOR_NAME },
      `Bearer ${SERVICE_TOKEN}`,
      withActorId,
    );

    const [row] = await auditRows(`redrive-event-${id}`);

    expect(row.event.user).toBe(OPERATOR_ID);
  });

  it("names the operator's id in a purge's audit row", async () => {
    const id = await aDeadInboxRow();

    await purgeInboxEvent(
      id,
      { by: OPERATOR_NAME, reasonCode: "BROKEN_PAYLOAD" },
      `Bearer ${SERVICE_TOKEN}`,
      withActorId,
    );

    expect((await auditRowFor(id, "PURGE_EVENT")).event.user).toBe(OPERATOR_ID);
  });

  it("names the operator's id in a payload edit's audit row", async () => {
    const event = {
      id: "evt-1",
      type: EDIT_TYPE,
      time: "2026-06-16T10:00:00.000Z",
      data: { amount: "12" },
    };
    const id = await aDeadInboxRow({ type: EDIT_TYPE, event });

    await editInboxPayload(
      id,
      {
        by: OPERATOR_NAME,
        payload: { ...event, data: { amount: 12 } },
        note: "amount was a string",
        revision: 0,
      },
      `Bearer ${SERVICE_TOKEN}`,
      withActorId,
    );

    expect((await auditRowFor(id, "EDIT_EVENT_PAYLOAD")).event.user).toBe(
      OPERATOR_ID,
    );
  });
});
