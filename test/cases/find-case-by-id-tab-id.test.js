import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createCase } from "../helpers/cases.js";
import { createAdminUser } from "../helpers/users.js";
import { createWorkflow } from "../helpers/workflows.js";
import { wreck } from "../helpers/wreck.js";

describe("GET /cases/{caseId}/tabs/{tabId}", () => {
  let cases;
  let client;

  beforeAll(async () => {
    client = new MongoClient(env.MONGO_URI);
    await client.connect();
    cases = client.db().collection("cases");
  });

  afterAll(async () => {
    await client.close(true);
  });

  beforeEach(async () => {
    await createAdminUser();
    await createWorkflow();
  });

  it("returns case-details tab content successfully", async () => {
    const kase = await createCase(cases, {
      payload: {
        businessName: "Test Farm Ltd",
        clientRef: "APPLICATION-REF-1",
        code: "frps-private-beta",
        createdAt: "2025-03-27T10:34:52.000Z",
        submittedAt: "2025-03-28T11:30:52.000Z",
        identifiers: {
          sbi: "SBI001",
          frn: "FIRM0001",
          crn: "CUST0001",
          defraId: "DEFRA0001",
        },
        answers: {
          scheme: "SFI",
          year: 2025,
          hasCheckedLandIsUpToDate: true,
          actionApplications: [
            {
              parcelId: "9238",
              sheetId: "SX0679",
              code: "CSAM1",
              appliedFor: {
                unit: "ha",
                quantity: 20.23,
              },
            },
          ],
        },
      },
    });

    const response = await wreck.get(`/cases/${kase._id}/tabs/case-details`);

    expect(response.res.statusCode).toBe(200);
    expect(response.payload).toBeDefined();
    expect(response.payload.content).toBeDefined();
    expect(Array.isArray(response.payload.content)).toBe(true);

    const contentTypes = response.payload.content.map((item) => item.component);
    expect(contentTypes).toContain("heading");
    expect(contentTypes).toContain("list");
    expect(contentTypes).toContain("table");
  });

  it("returns agreements tab content when supplementary data exists", async () => {
    const kase = await createCase(cases, {
      payload: {
        businessName: "Test Farm Ltd",
      },
      supplementaryData: {
        agreements: [
          {
            agreementRef: "AGR-001",
            createdAt: "2025-01-15T10:00:00.000Z",
            agreementStatus: "ACCEPTED",
          },
        ],
      },
    });

    const response = await wreck.get(`/cases/${kase._id}/tabs/agreements`);

    expect(response.res.statusCode).toBe(200);
    expect(response.payload).toBeDefined();
    expect(response.payload.content).toBeDefined();
    expect(Array.isArray(response.payload.content)).toBe(true);
  });

  it("returns 404 when case does not exist", async () => {
    const nonExistentCaseId = "507f1f77bcf86cd799439011";

    await expect(
      wreck.get(`/cases/${nonExistentCaseId}/tabs/case-details`),
    ).rejects.toThrow("Response Error: 404 Not Found");
  });

  it("returns 400 for invalid case id format", async () => {
    const invalidCaseId = "invalid-case-id";

    await expect(
      wreck.get(`/cases/${invalidCaseId}/tabs/case-details`),
    ).rejects.toThrow("Bad Request");
  });

  it("handles tab rendering with query parameters", async () => {
    const kase = await createCase(cases, {
      payload: {
        businessName: "Test Farm Ltd",
      },
    });

    const response = await wreck.get(
      `/cases/${kase._id}/tabs/case-details?filter=test`,
    );

    expect(response.res.statusCode).toBe(200);
    expect(response.payload).toBeDefined();
  });

  it("returns 404 for non-existent tab", async () => {
    const kase = await createCase(cases, {
      payload: {
        businessName: "Test Farm Ltd",
      },
    });

    await expect(
      wreck.get(`/cases/${kase._id}/tabs/non-existent-tab`),
    ).rejects.toThrow("Response Error: 404 Not Found");
  });

  it("handles case with minimal payload data", async () => {
    const kase = await createCase(cases, {
      payload: {
        clientRef: "MIN-REF-1",
      },
    });

    const response = await wreck.get(`/cases/${kase._id}/tabs/case-details`);

    expect(response.res.statusCode).toBe(200);
    expect(response.payload).toBeDefined();
  });
});
