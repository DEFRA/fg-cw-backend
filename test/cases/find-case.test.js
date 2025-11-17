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
      _id: caseId,
      caseRef: caseData2.caseRef,
      workflowCode: caseData2.workflowCode,
      currentStatus: "AWAITING_REVIEW",
      stage: {
        code: "APPLICATION_RECEIPT",
        name: "Application Receipt",
        description: "Application received",
        interactive: null,
        taskGroups: [
          {
            code: "APPLICATION_RECEIPT_TASKS",
            name: "Application Receipt tasks",
            description: "Task group description",
            tasks: [
              {
                code: "SIMPLE_REVIEW",
                name: "Simple Review",
                description: [
                  {
                    component: "heading",
                    level: 2,
                    text: "Simple review task",
                  },
                ],
                status: "PENDING",
                completed: false,
                mandatory: true,
                statusOptions: [],
                commentInputDef: {
                  helpText: "All notes will be saved for auditing purposes",
                  label: "Note",
                  mandatory: false,
                },
                commentRef: null,
                updatedAt: null,
                updatedBy: null,
                requiredRoles: {
                  allOf: ["ROLE_1", "ROLE_2"],
                  anyOf: ["ROLE_3"],
                },
              },
            ],
          },
        ],
        actions: [
          {
            code: "APPROVE",
            name: "Approve",
            comment: null,
          },
        ],
        actionsDisabled: true,
      },
      dateReceived: new Date(caseData2.dateReceived).toISOString(),
      payload: caseData2.payload,
      supplementaryData: caseData2.supplementaryData,
      assignedUser: null,
      requiredRoles: {
        allOf: ["ROLE_1", "ROLE_2"],
        anyOf: ["ROLE_3"],
      },
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
      comments: [],
      timeline: [
        {
          ...caseData2.timeline[0],
          createdBy: {
            id: "System",
            name: "System",
          },
        },
      ],
    });
  });
});
