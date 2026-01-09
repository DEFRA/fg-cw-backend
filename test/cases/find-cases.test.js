import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { caseData1, caseData2 } from "../fixtures/case.js";
import { createAdminUser } from "../helpers/users.js";
import { createWorkflow } from "../helpers/workflows.js";
import { wreck } from "../helpers/wreck.js";

let client;
let cases;

beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  cases = client.db().collection("cases");
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
        dateReceived: new Date(caseData1.dateReceived),
      },
      {
        ...caseData2,
        dateReceived: new Date(caseData2.dateReceived),
      },
    ]);

    const response = await wreck.get("/cases");

    expect(response.res.statusCode).toBe(200);

    expect(response.payload).toEqual([
      {
        _id: expect.any(String),
        caseRef: caseData1.caseRef,
        workflowCode: caseData1.workflowCode,
        dateReceived: new Date(caseData1.dateReceived).toISOString(),
        currentStatus: "Awaiting Review",
        currentStatusTheme: "INFO",
        assignedUser: null,
        payload: caseData1.payload,
      },
      {
        _id: expect.any(String),
        caseRef: caseData2.caseRef,
        workflowCode: caseData2.workflowCode,
        dateReceived: new Date(caseData2.dateReceived).toISOString(),
        currentStatus: "Awaiting Review",
        currentStatusTheme: "INFO",
        assignedUser: null,
        payload: caseData2.payload,
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
        dateReceived: new Date(caseData1.dateReceived),
      },
      {
        ...caseData1,
        caseRef: "UNAUTHORIZED-CASE",
        workflowCode: "WF-2",
        dateReceived: new Date(caseData1.dateReceived),
      },
      {
        ...caseData1,
        caseRef: "AUTHORIZED-CASE",
        workflowCode: "WF-3",
        dateReceived: new Date(caseData1.dateReceived),
      },
    ]);

    const response = await wreck.get("/cases");

    expect(response.res.statusCode).toBe(200);
    expect(response.payload.length).toBe(2);

    expect(response.payload[0].caseRef).toBe("UNRESTRCITED-CASE");
    expect(response.payload[0].workflowCode).toBe("WF-1");

    expect(response.payload[1].caseRef).toBe("AUTHORIZED-CASE");
    expect(response.payload[1].workflowCode).toBe("WF-3");
  });
});
