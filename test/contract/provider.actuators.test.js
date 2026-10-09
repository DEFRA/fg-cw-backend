// Provider test: verify fg-cw-backend's case actuators answer what
// fg-gas-backend expects, over HTTP (GAS's consumer.cw-backend-actuators.test.js).
//
// Each state seeds through CW's own write path - the case.create use cases,
// the domain models and their repositories - so the pact follows any change in
// how cases, series or inbox rows are stored. Every replayed request carries a
// real service token, so the public-api strategy and requireCaseReader run as
// they do in production.
import { Verifier } from "@pact-foundation/pact";
import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Inbox } from "../../src/cases/models/inbox.js";
import {
  findByCaseRefAndWorkflowCode,
  update as updateSeries,
} from "../../src/cases/repositories/case-series.repository.js";
import {
  insertOne,
  update as updateInbox,
} from "../../src/cases/repositories/inbox.repository.js";
import { newCaseUseCase } from "../../src/cases/use-cases/new-case.use-case.js";
import { processConfigVersionUseCase } from "../../src/cases/use-cases/process-config-version.use-case.js";
import {
  getSegregationRef,
  messageSource,
} from "../../src/cases/use-cases/save-inbox-message.use-case.js";
import { submitCaseUseCase } from "../../src/cases/use-cases/submit-case.use-case.js";
import { mongoClient } from "../../src/common/mongo-client.js";
import { markPermanentFailure } from "../../src/events/retryable.js";
import { seedServiceToken } from "../helpers/actuators.js";
import {
  CONFIG_BUCKET,
  cwKey,
  manifestFor,
  putConfigFile,
  workflowDefinition,
} from "../helpers/config-broker.js";
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
const CONFIG_VERSION = "1.0.0";
const BROWSE_CASES = 25;
const HOLDER = "pact-holder";

let client;
let db;

// A case.create command as GAS sends it. The pact matches the payload only as
// "an object", as its shape belongs to each workflow.
const caseCreated = ({ workflowCode, caseRef }) => ({
  id: randomUUID(),
  time: NOW.toISOString(),
  source: "fg-gas-backend",
  specversion: "1.0",
  type: "cloud.defra.test.fg-gas-backend.case.create",
  datacontenttype: "application/json",
  data: {
    caseRef,
    workflowCode,
    payload: {
      createdAt: NOW.toISOString(),
      submittedAt: NOW.toISOString(),
      configVersion: CONFIG_VERSION,
      identifiers: { sbi: "SBI001", frn: "FIRM0001", crn: "CUST0001" },
      answers: { anything: ["the workflow's own shape"] },
    },
  },
});

// The row the subscriber stores and the inbox handler is given.
const received = (message, _id) =>
  new Inbox({
    _id,
    event: message,
    messageId: message.id,
    type: message.type,
    source: messageSource.Gas,
    segregationRef: getSegregationRef(message),
  });

// The models stamp createdAt from the clock, so it is set for the write.
const at = async (date, write) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(date);

  try {
    return await write();
  } finally {
    vi.useRealTimers();
  }
};

const submitCase = (ref, createdAt = NOW) =>
  at(createdAt, () => submitCaseUseCase(received(caseCreated(ref))));

// replaceCaseUseCase replaces only a closed case, and GAS's pact reads every
// member of the series open, so later refs join the series as it adds them.
const extendSeries = (ref, previousCaseRef, createdAt) =>
  at(createdAt, async () => {
    const caseId = await newCaseUseCase(received(caseCreated(ref)));
    const series = await findByCaseRefAndWorkflowCode(
      previousCaseRef,
      ref.workflowCode,
    );

    series.addCaseRef(ref.caseRef, caseId.toString());
    await updateSeries(series);
  });

const seedTokenFor = (serviceClient) =>
  seedServiceToken(db, { client: serviceClient, token: TOKEN });

const reset = () =>
  Promise.all(
    ["cases", "case_series", "workflows", "inbox", "outbox"].map((name) =>
      db.collection(name).deleteMany({}),
    ),
  );

// As the config broker publishes them; each case's workflow is then fetched
// and stored by the case.create path itself.
const publishWorkflows = async () => {
  for (const grantCode of WORKFLOWS) {
    await putConfigFile(
      cwKey(grantCode, CONFIG_VERSION),
      workflowDefinition(grantCode),
    );
    await processConfigVersionUseCase({
      event: {
        data: {
          grantCode,
          version: CONFIG_VERSION,
          status: "active",
          manifest: manifestFor(grantCode, CONFIG_VERSION),
          s3Bucket: CONFIG_BUCKET,
        },
      },
    });
  }
};

const stateHandlers = {
  // Enough cases for a first page with a next one, in more than one workflow.
  "cases exist": async () => {
    for (let i = 0; i < BROWSE_CASES; i++) {
      await submitCase(
        {
          workflowCode: WORKFLOWS[i % WORKFLOWS.length],
          caseRef: `browse-${i}`,
        },
        new Date(NOW.getTime() - i * HOUR_MS),
      );
    }
  },

  "a case series exists": async ({ workflowCode, caseRefs }) => {
    const createdAt = (i) =>
      new Date(NOW.getTime() - (caseRefs.length - 1 - i) * DAY_MS);
    const [first, ...rest] = caseRefs;

    await submitCase({ workflowCode, caseRef: first }, createdAt(0));

    for (const [i, caseRef] of rest.entries()) {
      await extendSeries(
        { workflowCode, caseRef },
        caseRefs[i],
        createdAt(i + 1),
      );
    }
  },

  "a case exists": ({ workflowCode, caseRef }) =>
    submitCase({ workflowCode, caseRef }),

  "no case exists": async () => {},

  // Received as the subscriber stores it, then dead-lettered by a handler
  // holding a far-future claim, so the poller never picks it up meanwhile.
  "an inbox event names a case": async ({
    id,
    workflowCode,
    caseRef,
    caseExists,
  }) => {
    if (caseExists) {
      await submitCase({ workflowCode, caseRef });
    }

    const inbox = received(
      caseCreated({ workflowCode, caseRef }),
      ObjectId.createFromHexString(id),
    );

    Object.assign(inbox, {
      claimedBy: HOLDER,
      claimedAt: NOW,
      claimExpiresAt: FAR_FUTURE,
    });
    await insertOne(inbox);

    inbox.markAsFailed(
      markPermanentFailure(new Error("Rejected for the pact")),
    );
    await updateInbox(inbox, HOLDER);
  },

  "the caller is not fg-gas-backend": () => seedTokenFor(OTHER_CLIENT),
};

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  db = client.db();
  await publishWorkflows();
});

afterAll(async () => {
  await mongoClient.close(true);
  await client?.close(true);
});

describe("CW case actuators provider (answers GAS over HTTP)", () => {
  it("answers every interaction in GAS's pact", async () => {
    await expect(
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
      }).verifyProvider(),
    ).resolves.not.toThrow();
  });
});
