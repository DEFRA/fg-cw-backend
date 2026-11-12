import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { IdpRoles } from "../../src/users/models/idp-roles.js";
import { completeTask, createCase } from "../helpers/cases.js";
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

beforeEach(async () => {
  await createAdminUser({
    idpRoles: [IdpRoles.Admin, IdpRoles.ReadWrite, IdpRoles.Read],
  });
  await createWorkflow();
});

const createCaseWithSeries = async () => {
  const kase = await createCase(cases);
  const now = new Date().toISOString();
  await caseSeries.insertOne({
    caseRefs: [kase.caseRef],
    workflowCode: kase.workflowCode,
    latestCaseRef: kase.caseRef,
    latestCaseId: kase._id.toHexString(),
    createdAt: now,
    updatedAt: now,
  });
  return kase;
};

describe("case timeline descriptions", () => {
  it.each(["Stored historic wording", undefined])(
    "opens a case with a removed historical task group (description=%s)",
    async (description) => {
      const kase = await createCaseWithSeries();
      const history = {
        eventType: "TASK_COMPLETED",
        createdAt: "2025-01-01T00:00:00.000Z",
        createdBy: "System",
        data: {
          phaseCode: "DEFAULT",
          stageCode: "APPLICATION_RECEIPT",
          taskGroupCode: "TASK_GROUP_FC_REVIEW",
          taskCode: "TASK_FC_REVIEW_OUTCOME",
        },
      };
      // BSON serialises undefined object properties as null by default. Omit
      // the field to exercise a legacy event with no stored description.
      if (description !== undefined) {
        history.description = description;
      }
      await cases.updateOne(
        { _id: kase._id },
        { $push: { timeline: history } },
      );
      const before = await cases.findOne({ _id: kase._id });
      const response = await wreck.get(`/cases/${kase._id}`);
      expect(response.res.statusCode).toBe(200);
      expect(response.payload.data.timeline).toContainEqual(
        expect.objectContaining({
          eventType: "TASK_COMPLETED",
          description: description || "Task completed",
        }),
      );
      const after = await cases.findOne({ _id: kase._id });
      expect(after.timeline).toEqual(before.timeline);
    },
  );

  it("renders a persisted snapshot without exposing its internal version marker", async () => {
    const kase = await createCaseWithSeries();
    await completeTask({
      caseId: kase._id,
      taskGroupCode: "APPLICATION_RECEIPT_TASKS",
      taskCode: "SIMPLE_REVIEW",
    });
    const stored = await cases.findOne({ _id: kase._id });
    expect(stored.timeline[0]).toMatchObject({
      descriptionVersion: 1,
      description: "Task 'Simple Review' completed",
    });
    const response = await wreck.get(`/cases/${kase._id}`);
    expect(response.res.statusCode).toBe(200);
    expect(response.payload.data.timeline[0].description).toBe(
      "Task 'Simple Review' completed",
    );
    expect(response.payload.data.timeline[0]).not.toHaveProperty(
      "descriptionVersion",
    );
  });
});
