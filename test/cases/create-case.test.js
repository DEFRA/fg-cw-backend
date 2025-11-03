import { MongoClient, ObjectId } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { caseData3Document } from "../fixtures/case.js";
import createCaseEvent3 from "../fixtures/create-case-event-3.json";
import { sendMessage } from "../helpers/sqs.js";
import { waitForDocuments } from "../helpers/wait-for-documents.js";
import { createWorkflow } from "../helpers/workflows.js";

let cases;

let client;
let inbox;

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  cases = client.db().collection("cases");
  inbox = client.db().collection("inbox");
});

afterAll(async () => {
  await client.close(true);
});

describe("On CreateNewCase event", () => {
  beforeEach(async () => {
    await createWorkflow();
  });

  it("creates a new case", async () => {
    const expected = [
      {
        ...caseData3Document,
        _id: expect.any(ObjectId),
        dateReceived: expect.any(Date),
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
    ];

    expected[0].phases[0].stages[0].taskGroups[0].tasks[0].commentRef = null;
    expected[0].phases[0].stages[0].taskGroups[0].tasks[0].updatedAt = null;
    expected[0].phases[0].stages[0].taskGroups[0].tasks[0].updatedBy = null;
    expected[0].phases[0].stages[0].outcome = null;
    expected[0].phases[0].stages[1].outcome = null;

    await sendMessage(env.CW__SQS__CREATE_NEW_CASE_URL, createCaseEvent3);

    const documents = await waitForDocuments(inbox, 3, {
      target: env.CW__SQS__CREATE_NEW_CASE_URL,
    });

    expect(documents).toHaveLength(1);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const caseDocs = await waitForDocuments(cases);
    expect(caseDocs).toEqual(expected);
  });
});
