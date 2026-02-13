import { MongoClient, ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { caseData3Document } from "../fixtures/case.js";
import createCaseEvent3 from "../fixtures/create-case-event-3.json";
import { sendMessage } from "../helpers/sqs.js";
import { createAdminUser } from "../helpers/users.js";
import { waitForDocuments } from "../helpers/wait-for-documents.js";
import { createWorkflow } from "../helpers/workflows.js";

let client;
let cases;

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  cases = client.db().collection("cases");
});

afterAll(async () => {
  await client.close(true);
});

describe("On CreateNewCase event", () => {
  beforeEach(async () => {
    await createAdminUser();
    await createWorkflow();
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
  });
});
