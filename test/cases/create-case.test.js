import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
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
import { caseData3Document } from "../fixtures/case.js";
import createCaseEvent3 from "../fixtures/create-case-event-3.json";
import { sendMessage } from "../helpers/sqs.js";
import { createAdminUser } from "../helpers/users.js";
import { waitForDocuments } from "../helpers/wait-for-documents.js";
import { createWorkflow } from "../helpers/workflows.js";

let client;
let cases;
let caseSeries;
let outbox;

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  cases = client.db().collection("cases");
  caseSeries = client.db().collection("case_series");
  outbox = client.db().collection("outbox");
});

afterAll(async () => {
  await client.close(true);
});

describe("On CreateNewCase event", () => {
  beforeEach(async () => {
    await createAdminUser();
    await createWorkflow();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a new case", async () => {
    await sendMessage(env.CW__SQS__CREATE_NEW_CASE_URL, {
      ...createCaseEvent3,
      id: randomUUID(),
    });

    const caseDocs = await waitForDocuments(cases);

    expect(caseDocs).toEqual([
      {
        ...caseData3Document,
        _id: expect.any(ObjectId),
        createdAt: expect.any(Date),
        closedAt: null,
        timeline: [
          {
            commentRef: null,
            eventType: "CASE_CREATED",
            createdAt: expect.any(String),
            description: "Case received",
            createdBy: "System",
            data: {
              caseRef: "CASE-REF-3",
            },
          },
        ],
      },
    ]);

    const caseSeriesDocs = await waitForDocuments(caseSeries);
    expect(caseSeriesDocs).toEqual([
      {
        _id: expect.any(ObjectId),
        caseRefs: ["CASE-REF-3"],
        createdAt: expect.any(String),
        latestCaseId: expect.any(String),
        latestCaseRef: "CASE-REF-3",
        updatedAt: expect.any(String),
        workflowCode: "frps-private-beta",
      },
    ]);
  });

  it("writes a CREATE_CASE audit event to the outbox with a system actor", async () => {
    await sendMessage(env.CW__SQS__CREATE_NEW_CASE_URL, {
      ...createCaseEvent3,
      id: randomUUID(),
    });

    const [outboxEntry] = await waitForDocuments(outbox, 10, {
      "event.audit.entities.action": "CREATE_CASE",
    });

    expect(outboxEntry).toMatchObject({
      event: {
        audit: {
          entities: [
            {
              entity: "CASE",
              action: "CREATE_CASE",
              entityid: "CASE-REF-3",
            },
          ],
          status: "SUCCESS",
          details: {
            security: {
              actor: {
                id: "fg-gas-backend",
                name: "GAS (system)",
              },
            },
          },
        },
        security: { pmccode: "0706" },
      },
      target: expect.stringMatching(/^arn:aws:sns:eu-west-2:\d+:.*audit.*$/),
    });
  });
});
