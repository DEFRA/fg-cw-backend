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
import createCaseEvent from "../fixtures/create-case-event-3.json";
import { sendMessage } from "../helpers/sqs.js";
import { createAdminUser } from "../helpers/users.js";
import { waitForDocuments } from "../helpers/wait-for-documents.js";
import { createWorkflow } from "../helpers/workflows.js";

let client;
let cases;
let caseSeries;

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  cases = client.db().collection("cases");
  caseSeries = client.db().collection("case_series");
});

afterAll(async () => {
  await client.close(true);
});

describe("Replaces a case on CreateNewCase event", () => {
  beforeEach(async () => {
    await createAdminUser();
    await createWorkflow();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("replaces a case", async () => {
    await sendMessage(env.CW__SQS__CREATE_NEW_CASE_URL, {
      ...createCaseEvent,
    });

    await waitForDocuments(cases);

    await cases.updateOne(
      { caseRef: "CASE-REF-3", workflowCode: "frps-private-beta" },
      { $set: { closed: true } },
    );

    // replace case
    await sendMessage(env.CW__SQS__CREATE_NEW_CASE_URL, {
      ...createCaseEvent,
      id: randomUUID(),
      data: {
        ...createCaseEvent.data,
        caseRef: "CASE-REF-4",
        previousCaseRef: "CASE-REF-3",
      },
    });

    const caseSeriesDocs = await waitForDocuments(caseSeries, 10, {
      latestCaseRef: "CASE-REF-4",
    });
    expect(caseSeriesDocs).toEqual([
      {
        _id: expect.any(ObjectId),
        caseRefs: ["CASE-REF-3", "CASE-REF-4"],
        createdAt: expect.any(String),
        latestCaseId: expect.any(String),
        latestCaseRef: "CASE-REF-4",
        updatedAt: expect.any(String),
        workflowCode: "frps-private-beta",
      },
    ]);

    const caseDocs = await waitForDocuments(cases, 10, {
      caseRef: "CASE-REF-4",
    });

    expect(caseDocs).toEqual([
      {
        ...caseData3Document,
        caseRef: "CASE-REF-4",
        closed: false,
        _id: expect.any(ObjectId),
        createdAt: expect.any(Date),
        timeline: [
          {
            commentRef: null,
            eventType: "CASE_CREATED",
            createdAt: expect.any(String),
            description: "Case received",
            createdBy: "System",
            data: {
              caseRef: "CASE-REF-4",
            },
          },
        ],
      },
    ]);
  }, 7000);
});
