import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { caseData1, caseData2 } from "../fixtures/case.js";
import { changeUserAppRoles, createAdminUser } from "../helpers/users.js";
import { createWorkflow } from "../helpers/workflows.js";
import { wreck } from "../helpers/wreck.js";

let client;
let cases;
let caseSeries;
let admin;

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  cases = client.db().collection("cases");
  caseSeries = client.db().collection("case_series");
});

afterAll(async () => {
  await client.close(true);
});

describe("GET /types/{caseType}/cases", () => {
  beforeEach(async () => {
    admin = await createAdminUser();
  });

  it("returns only cases for the requested case type", async () => {
    await createWorkflow({ code: "WF-A" });
    await createWorkflow({ code: "WF-B" });

    const now = new Date().toISOString();

    await cases.insertMany([
      {
        ...caseData1,
        caseRef: "CASE-A-1",
        workflowCode: "WF-A",
        createdAt: new Date(caseData1.createdAt),
      },
      {
        ...caseData2,
        caseRef: "CASE-B-1",
        workflowCode: "WF-B",
        createdAt: new Date(caseData2.createdAt),
      },
    ]);

    await caseSeries.insertMany([
      {
        caseRefs: ["CASE-A-1"],
        workflowCode: "WF-A",
        latestCaseRef: "CASE-A-1",
        latestCaseId: "case-a-1",
        createdAt: now,
        updatedAt: now,
      },
      {
        caseRefs: ["CASE-B-1"],
        workflowCode: "WF-B",
        latestCaseRef: "CASE-B-1",
        latestCaseId: "case-b-1",
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const response = await wreck.get("/types/WF-A/cases");

    expect(response.res.statusCode).toBe(200);
    expect(response.payload.data.cases).toHaveLength(1);
    expect(response.payload.data.cases[0].caseRef).toBe("CASE-A-1");
    expect(response.payload.data.cases[0].workflowCode).toBe("WF-A");
    expect(response.payload.data.pagination.totalCount).toBe(1);
  });

  it("returns 404 when the case type does not exist", async () => {
    await expect(wreck.get("/types/DOES-NOT-EXIST/cases")).rejects.toThrow(
      "Response Error: 404 Not Found",
    );
  });

  it("returns 403 when the user lacks roles for the case type", async () => {
    await createWorkflow({
      code: "WF-RESTRICTED",
      requiredRoles: {
        allOf: ["ROLE_USER_DOES_NOT_HAVE"],
        anyOf: [],
      },
    });

    await changeUserAppRoles(admin, {});

    await expect(wreck.get("/types/WF-RESTRICTED/cases")).rejects.toThrow(
      "Response Error: 403 Forbidden",
    );
  });

  it("returns empty list when case type exists but has no cases", async () => {
    await createWorkflow({ code: "WF-EMPTY" });

    const response = await wreck.get("/types/WF-EMPTY/cases");

    expect(response.res.statusCode).toBe(200);
    expect(response.payload.data.cases).toHaveLength(0);
    expect(response.payload.data.pagination.totalCount).toBe(0);
  });
});
