import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { caseData1, caseData2 } from "../fixtures/case.js";
import { createAdminUser } from "../helpers/users.js";
import { createWorkflow } from "../helpers/workflows.js";
import { wreck } from "../helpers/wreck.js";

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
});
