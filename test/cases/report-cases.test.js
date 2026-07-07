import { env } from "node:process";
import { MongoClient } from "mongodb";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { caseData1 } from "../fixtures/case.js";
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

// A valid case document (caseData1) re-positioned to a chosen lifecycle point.
const seedCaseAt = (caseRef, currentStage, currentStatus) => ({
  ...caseData1,
  caseRef,
  currentStage,
  currentStatus,
  createdAt: new Date(caseData1.createdAt),
});

describe("GET /cases/report", () => {
  beforeEach(async () => {
    await createAdminUser();
  });

  it("counts cases by lifecycle position and rolls them up", async () => {
    await createWorkflow();

    await cases.insertMany([
      seedCaseAt("R-1", "APPLICATION_RECEIPT", "AWAITING_REVIEW"),
      seedCaseAt("R-2", "APPLICATION_RECEIPT", "AWAITING_REVIEW"),
      seedCaseAt("R-3", "CONTRACT", "AWAITING_AGREEMENT"),
    ]);

    const response = await wreck.get(
      "/cases/report?workflowCode=frps-private-beta",
    );

    expect(response.res.statusCode).toBe(200);
    // Real aggregation over real Mongo, rolled up using the workflow's names.
    expect(response.payload.data).toEqual({
      selectedCaseType: "frps-private-beta",
      availableCaseTypes: ["frps-private-beta"],
      total: 3,
      phases: [
        {
          code: "DEFAULT",
          name: "Default Phase",
          count: 3,
          stages: [
            {
              code: "APPLICATION_RECEIPT",
              name: "Application Receipt",
              count: 2,
              statuses: [
                {
                  code: "AWAITING_REVIEW",
                  name: "Awaiting Review",
                  theme: "INFO",
                  count: 2,
                },
              ],
            },
            {
              code: "CONTRACT",
              name: "Stage for contract management",
              count: 1,
              statuses: [
                {
                  code: "AWAITING_AGREEMENT",
                  name: "Awaiting Agreement",
                  theme: "INFO",
                  count: 1,
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it("returns an empty report for a case type with no cases", async () => {
    await createWorkflow();

    const response = await wreck.get(
      "/cases/report?workflowCode=frps-private-beta",
    );

    expect(response.res.statusCode).toBe(200);
    expect(response.payload.data).toEqual({
      selectedCaseType: "frps-private-beta",
      availableCaseTypes: ["frps-private-beta"],
      total: 0,
      phases: [],
    });
  });

  it("makes no selection on first visit when no case type is requested", async () => {
    await createWorkflow();

    // Cases exist, but with no case type requested nothing is counted.
    await cases.insertMany([
      seedCaseAt("R-1", "APPLICATION_RECEIPT", "AWAITING_REVIEW"),
    ]);

    const response = await wreck.get("/cases/report");

    expect(response.res.statusCode).toBe(200);
    expect(response.payload.data).toEqual({
      selectedCaseType: null,
      availableCaseTypes: ["frps-private-beta"],
      total: 0,
      phases: [],
    });
  });
});
