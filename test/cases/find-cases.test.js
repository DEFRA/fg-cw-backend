import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { caseData1, caseData2 } from "../fixtures/case.js";
import { createAdminUser, TestUser } from "../helpers/users.js";
import { waitForDocuments } from "../helpers/wait-for-documents.js";
import { createWorkflow } from "../helpers/workflows.js";
import { wreck } from "../helpers/wreck.js";

let client;
let cases;
let caseSeries;
let outbox;
let workflows;

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  cases = client.db().collection("cases");
  caseSeries = client.db().collection("case_series");
  outbox = client.db().collection("outbox");
  workflows = client.db().collection("workflows");
});

afterAll(async () => {
  await client.close(true);
});

describe("GET /cases", () => {
  beforeEach(async () => {
    await createAdminUser();
  });

  it("finds cases", async () => {
    await createWorkflow();

    await cases.insertMany([
      {
        ...caseData1,
        createdAt: new Date(caseData1.createdAt),
      },
      {
        ...caseData2,
        createdAt: new Date(caseData2.createdAt),
      },
    ]);

    const now = new Date().toISOString();
    await caseSeries.insertMany([
      {
        caseRefs: [caseData1.caseRef],
        workflowCode: caseData1.workflowCode,
        latestCaseRef: caseData1.caseRef,
        latestCaseId: "case-1",
        createdAt: now,
        updatedAt: now,
      },
      {
        caseRefs: [caseData2.caseRef],
        workflowCode: caseData2.workflowCode,
        latestCaseRef: caseData2.caseRef,
        latestCaseId: "case-2",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const response = await wreck.get("/cases");

    expect(response.res.statusCode).toBe(200);
    expect(response.payload.header).toEqual({
      navItems: [
        { title: "Admin", href: "/admin" },
        { title: "Casework", href: "/cases" },
      ],
    });
    expect(response.payload.data.pagination).toBeDefined();
    expect(response.payload.data.cases).toEqual([
      {
        _id: expect.any(String),
        caseRef: caseData2.caseRef,
        workflowCode: caseData2.workflowCode,
        schemeName: caseData2.workflowCode,
        createdAt: new Date(caseData2.createdAt).toISOString(),
        currentStatus: "Awaiting Review",
        currentStatusTheme: "INFO",
        hasLinkedCases: false,
        assignedUser: null,
        payload: caseData2.payload,
      },
      {
        _id: expect.any(String),
        caseRef: caseData1.caseRef,
        workflowCode: caseData1.workflowCode,
        schemeName: caseData1.workflowCode,
        createdAt: new Date(caseData1.createdAt).toISOString(),
        currentStatus: "Awaiting Review",
        currentStatusTheme: "INFO",
        hasLinkedCases: false,
        assignedUser: null,
        payload: caseData1.payload,
      },
    ]);
  });

  it("exludes cases user does not have access to", async () => {
    await createWorkflow({
      code: "WF-1",
      requiredRoles: {
        allOf: [],
        anyOf: [],
      },
    });

    await createWorkflow({
      code: "WF-2",
      requiredRoles: {
        allOf: ["ROLE_USER_DOES_NOT_HAVE"],
        anyOf: [],
      },
    });

    await createWorkflow({
      code: "WF-3",
      requiredRoles: {
        allOf: ["ROLE_1", "ROLE_2"],
        anyOf: ["ROLE_3"],
      },
    });

    await cases.insertMany([
      {
        ...caseData1,
        caseRef: "UNRESTRCITED-CASE",
        workflowCode: "WF-1",
        createdAt: new Date(caseData1.createdAt),
      },
      {
        ...caseData1,
        caseRef: "UNAUTHORIZED-CASE",
        workflowCode: "WF-2",
        createdAt: new Date(caseData1.createdAt),
      },
      {
        ...caseData1,
        caseRef: "AUTHORIZED-CASE",
        workflowCode: "WF-3",
        createdAt: new Date(caseData1.createdAt),
      },
    ]);

    const now = new Date().toISOString();
    await caseSeries.insertMany([
      {
        caseRefs: ["UNRESTRCITED-CASE"],
        workflowCode: "WF-1",
        latestCaseRef: "UNRESTRCITED-CASE",
        latestCaseId: "case-1",
        createdAt: now,
        updatedAt: now,
      },
      {
        caseRefs: ["UNAUTHORIZED-CASE"],
        workflowCode: "WF-2",
        latestCaseRef: "UNAUTHORIZED-CASE",
        latestCaseId: "case-2",
        createdAt: now,
        updatedAt: now,
      },
      {
        caseRefs: ["AUTHORIZED-CASE"],
        workflowCode: "WF-3",
        latestCaseRef: "AUTHORIZED-CASE",
        latestCaseId: "case-3",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const response = await wreck.get("/cases");

    expect(response.res.statusCode).toBe(200);
    expect(response.payload.header).toEqual({
      navItems: [
        { title: "Admin", href: "/admin" },
        { title: "Casework", href: "/cases" },
      ],
    });
    expect(response.payload.data.cases.length).toBe(2);

    expect(response.payload.data.cases[0].caseRef).toBe("AUTHORIZED-CASE");
    expect(response.payload.data.cases[0].workflowCode).toBe("WF-3");

    expect(response.payload.data.cases[1].caseRef).toBe("UNRESTRCITED-CASE");
    expect(response.payload.data.cases[1].caseRef).toBe("UNRESTRCITED-CASE");
    expect(response.payload.data.cases[1].workflowCode).toBe("WF-1");
  });

  it("writes a VIEW_CASE_LIST audit event to the outbox with the actor's security context", async () => {
    const response = await wreck.get("/cases");

    expect(response.res.statusCode).toBe(200);

    const outboxEntry = await outbox.findOne({
      "event.audit.entities.action": "VIEW_CASE_LIST",
    });

    expect(outboxEntry).toMatchObject({
      event: {
        audit: {
          entities: [{ entity: "CASE", action: "VIEW_CASE_LIST" }],
          status: "SUCCESS",
          details: {
            security: {
              actor: {
                id: expect.any(String),
                idpId: TestUser.Admin.idpId,
                name: TestUser.Admin.name,
                email: TestUser.Admin.email,
                idpRoles: TestUser.Admin.idpRoles,
              },
            },
          },
        },
        security: { pmccode: "0706" },
      },
      target: expect.stringMatching(/^arn:aws:sns:eu-west-2:\d+:.*audit.*$/),
    });
  });

  // The audit topic is standard, not FIFO. Asserting the row is merely written
  // would still pass if the subscriber could not publish it - it would retry
  // and land in DEAD_LETTER. Wait for it to actually drain.
  it("publishes the VIEW_CASE_LIST audit event and marks the outbox row complete", async () => {
    const response = await wreck.get("/cases");

    expect(response.res.statusCode).toBe(200);

    const [completed] = await waitForDocuments(outbox, 15, {
      "event.audit.entities.action": "VIEW_CASE_LIST",
      status: "COMPLETED",
    });

    expect(completed.completionDate).toBeDefined();
    // messageGroupId is an SNS FIFO transport parameter - it must never be
    // published inside the message body, where it fails the audit schema.
    expect(completed.event).not.toHaveProperty("messageGroupId");
  });

  it("succeeds when an accessible workflow has an incompatible task structure", async () => {
    await createWorkflow();

    await workflows.insertOne({
      code: "incompatible-wf",
      version: "0.0.0",
      pages: {},
      phases: [
        {
          code: "DEFAULT",
          name: "Default",
          stages: [
            {
              code: "STAGE_1",
              name: "Stage One",
              description: "First stage",
              statuses: [
                {
                  code: "OPEN",
                  name: "Open",
                  theme: "INFO",
                  description: null,
                  interactive: true,
                  transitions: [],
                },
              ],
              taskGroups: [
                {
                  code: "GROUP_1",
                  name: "Group One",
                  description: "Tasks",
                  tasks: [
                    {
                      code: "TASK_WITHOUT_VALUE_OR_INPUT",
                      name: "Incompatible task",
                      description: "Has neither valueOptions nor input",
                      mandatory: true,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      requiredRoles: { allOf: [], anyOf: [] },
      definitions: {},
      endpoints: [],
    });

    await cases.insertOne({
      ...caseData1,
      caseRef: "VALID-WF-CASE",
      workflowCode: "frps-private-beta",
      createdAt: new Date(caseData1.createdAt),
    });

    const now = new Date().toISOString();
    await caseSeries.insertOne({
      caseRefs: ["VALID-WF-CASE"],
      workflowCode: "frps-private-beta",
      latestCaseRef: "VALID-WF-CASE",
      latestCaseId: "case-valid",
      createdAt: now,
      updatedAt: now,
    });

    const response = await wreck.get("/cases");

    expect(response.res.statusCode).toBe(200);
    expect(response.payload.data.cases.length).toBeGreaterThanOrEqual(1);

    const validCase = response.payload.data.cases.find(
      (c) => c.caseRef === "VALID-WF-CASE",
    );
    expect(validCase).toBeDefined();
    expect(validCase.workflowCode).toBe("frps-private-beta");
  });
});
