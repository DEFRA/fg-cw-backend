// Provider test: verify fg-cw-backend's case actuators answer what
// fg-gas-backend expects, over HTTP (GAS's consumer.cw-backend-actuators.test.js).
//
// Each state seeds Mongo directly, and every replayed request carries a real
// service token, so the public-api strategy and requireCaseReader run as they
// do in production.
import { Verifier } from "@pact-foundation/pact";
import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { env } from "node:process";
import { afterAll, beforeAll, describe, it } from "vitest";
import { seedServiceToken } from "../helpers/actuators.js";
import { CASE_READER_CLIENT } from "../helpers/service-token.js";
import { buildMessageVerifierOptions } from "./messageVerifierConfig.js";

const PROVIDER = "fg-cw-backend-actuators";
const OTHER_CLIENT = "fg-grants-platform-admin";

const TOKEN = randomUUID();
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const FAR_FUTURE = new Date("2099-01-01T00:00:00.000Z");
// Around the dates in GAS's pact, so its ranged browse finds cases.
const NOW = new Date("2026-06-16T10:00:00.000Z");
const WORKFLOWS = ["frps-private-beta", "woodland"];
const BROWSE_CASES = 25;

let client;
let db;

// Any object at all: the pact matches a payload only as "an object".
const OPAQUE_PAYLOAD = { answers: { anything: ["the workflow's own shape"] } };

const aCase = ({ workflowCode, caseRef, createdAt = NOW }) => ({
  _id: new ObjectId(),
  caseRef,
  workflowCode,
  currentPhase: "PRE_AWARD",
  currentStage: "REVIEW",
  currentStatus: "IN_REVIEW",
  closed: false,
  closedAt: null,
  createdAt,
  originalConfigVersion: "1.0.0",
  currentConfigVersion: "1.0.0",
  payload: OPAQUE_PAYLOAD,
  supplementaryData: {},
  phases: [],
  comments: [],
  timeline: [],
});

const seedTokenFor = (serviceClient) =>
  seedServiceToken(db, { client: serviceClient, token: TOKEN });

// Every state starts from no cases and the same workflow catalogue.
const reset = async () => {
  await Promise.all(
    ["cases", "case_series", "workflows", "inbox", "outbox"].map((name) =>
      db.collection(name).deleteMany({}),
    ),
  );
  await db
    .collection("workflows")
    .insertMany(WORKFLOWS.map((code) => ({ code })));
};

const seedSeries = (workflowCode, caseRefs) =>
  db.collection("case_series").insertOne({
    workflowCode,
    caseRefs,
    latestCaseRef: caseRefs.at(-1),
    latestCaseId: new ObjectId().toHexString(),
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  });

const stateHandlers = {
  // Enough cases for a first page with a next one, in more than one workflow.
  "cases exist": async () => {
    await db.collection("cases").insertMany(
      Array.from({ length: BROWSE_CASES }, (_, i) =>
        aCase({
          workflowCode: WORKFLOWS[i % WORKFLOWS.length],
          caseRef: `browse-${i}`,
          createdAt: new Date(NOW.getTime() - i * HOUR_MS),
        }),
      ),
    );
  },

  "a case series exists": async ({ workflowCode, caseRefs }) => {
    await seedSeries(workflowCode, caseRefs);
    await db.collection("cases").insertMany(
      caseRefs.map((caseRef, i) =>
        aCase({
          workflowCode,
          caseRef,
          createdAt: new Date(NOW.getTime() - i * DAY_MS),
        }),
      ),
    );
  },

  "a case exists": async ({ workflowCode, caseRef }) => {
    await seedSeries(workflowCode, [caseRef]);
    await db.collection("cases").insertOne(aCase({ workflowCode, caseRef }));
  },

  "no case exists": async () => {},

  "an inbox event names a case": async ({
    id,
    workflowCode,
    caseRef,
    caseExists,
  }) => {
    await db.collection("inbox").insertOne({
      _id: ObjectId.createFromHexString(id),
      messageId: `msg-${id}`,
      type: "cloud.defra.test.fg-gas-backend.case.create",
      source: "fg-gas-backend",
      segregationRef: `${caseRef}-${workflowCode}`,
      status: "DEAD_LETTER",
      completionAttempts: 5,
      eventTime: NOW.toISOString(),
      publicationDate: NOW.toISOString(),
      claimedBy: "pact-holder",
      claimExpiresAt: FAR_FUTURE,
      event: { id: `evt-${id}`, data: { caseRef, workflowCode } },
    });

    if (caseExists) {
      await db.collection("cases").insertOne(aCase({ workflowCode, caseRef }));
    }
  },

  // The same token, issued to a client the case actuators do not admit.
  "the caller is not fg-gas-backend": () => seedTokenFor(OTHER_CLIENT),
};

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  db = client.db();
});

afterAll(async () => {
  await client?.close(true);
});

describe("CW case actuators provider (answers GAS over HTTP)", () => {
  it("answers every interaction in GAS's pact", () =>
    new Verifier({
      ...buildMessageVerifierOptions({
        providerName: PROVIDER,
        consumerName: CASE_READER_CLIENT,
      }),
      providerBaseUrl: env.API_URL,
      stateHandlers,
      // Before the state handler, so a state can replace the token's client.
      beforeEach: async () => {
        await reset();
        await seedTokenFor(CASE_READER_CLIENT);
      },
      requestFilter: (req, _res, next) => {
        req.headers.authorization = `Bearer ${TOKEN}`;
        next();
      },
    }).verifyProvider());
});
