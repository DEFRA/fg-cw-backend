import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { caseData1, caseData2 } from "../fixtures/case.js";
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
    await createWorkflow();
  });

  it("finds cases", async () => {
    await cases.insertMany([
      {
        ...caseData1,
        requiredRoles: {
          allOf: ["ROLE_1", "ROLE_2"],
          anyOf: ["ROLE_3"],
        },
        dateReceived: new Date(caseData1.dateReceived),
        supplementaryData: { agreements: {} },
      },
      {
        ...caseData2,
        requiredRoles: {
          allOf: ["ROLE_1", "ROLE_2"],
          anyOf: ["ROLE_3"],
        },
        dateReceived: new Date(caseData2.dateReceived),
        supplementaryData: { agreements: {} },
      },
    ]);

    const response = await wreck.get("/cases");

    expect(response.res.statusCode).toBe(200);

    expect(response.payload).toEqual([
      {
        ...caseData1,
        tasks: {},
        _id: expect.any(String),
        dateReceived: new Date(caseData1.dateReceived).toISOString(),
      },
      {
        ...caseData2,
        tasks: {},
        _id: expect.any(String),
        dateReceived: new Date(caseData2.dateReceived).toISOString(),
      },
    ]);
  });
});
