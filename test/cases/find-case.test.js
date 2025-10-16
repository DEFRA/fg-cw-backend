import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { caseData1, caseData2 } from "../fixtures/case.js";
import { createWorkflow } from "../helpers/workflows.js";
import { wreck } from "../helpers/wreck.js";

let cases;

let client;

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  cases = client.db().collection("cases");
});

afterAll(async () => {
  await client.close(true);
});

describe("GET /cases/{caseId}", () => {
  beforeEach(async () => {
    await createWorkflow();
  });

  it("finds a case by id", async () => {
    const { insertedIds } = await cases.insertMany([
      {
        ...caseData1,
        dateReceived: new Date(caseData1.dateReceived),
      },
      {
        ...caseData2,
        dateReceived: new Date(caseData2.dateReceived),
      },
    ]);

    const caseId = insertedIds[1].toHexString();

    const response = await wreck.get(`/cases/${caseId}`);

    expect(response.res.statusCode).toBe(200);
    expect(response.payload).toEqual({
      ...caseData2,
      _id: caseId,
      dateReceived: new Date(caseData2.dateReceived).toISOString(),
      tasks: {},
      stages: [
        {
          ...caseData2.stages[0],
          name: "Application Receipt",
          description: "Application received",
          taskGroups: [
            {
              ...caseData2.stages[0].taskGroups[0],
              name: "Application Receipt tasks",
              description: "Task group description",
              tasks: [
                {
                  ...caseData2.stages[0].taskGroups[0].tasks[0],
                  updatedBy: null,
                },
              ],
            },
          ],
        },
        {
          ...caseData2.stages[1],
          name: "Stage for contract management",
          description: "Awaiting agreement",
        },
      ],
      timeline: [
        {
          ...caseData2.timeline[0],
          createdBy: {
            id: "System",
            name: "System",
          },
        },
      ],
      banner: {
        summary: {
          createdAt: {
            label: "Created At",
            text: "27 Mar 2025",
            type: "date",
          },
          reference: {
            label: "Reference",
            text: "CASE-REF-2",
            type: "string",
          },
          sbi: {
            label: "SBI",
            text: "SBI001",
            type: "string",
          },
          scheme: {
            label: "Scheme",
            text: "SFI",
            type: "string",
          },
        },
        title: {
          text: "",
          type: "string",
        },
      },
      links: [
        {
          href: `/cases/${caseId}`,
          id: "tasks",
          text: "Tasks",
        },
        {
          href: `/cases/${caseId}/case-details`,
          id: "case-details",
          text: "Case Details",
        },
        {
          href: `/cases/${caseId}/notes`,
          id: "notes",
          text: "Notes",
        },
        {
          href: `/cases/${caseId}/timeline`,
          id: "timeline",
          text: "Timeline",
        },
      ],
      supplementaryData: {},
    });
  });
});
