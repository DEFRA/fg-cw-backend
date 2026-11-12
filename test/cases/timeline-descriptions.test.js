import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { IdpRoles } from "../../src/users/models/idp-roles.js";
import { completeTask, createCase } from "../helpers/cases.js";
import { createAdminUser } from "../helpers/users.js";
import { createWorkflow } from "../helpers/workflows.js";
import { wreck } from "../helpers/wreck.js";

const renamedWorkflowCode = `timeline-${randomUUID()}`;

let client;
let cases;
let caseSeries;
beforeAll(async () => {
  client = await MongoClient.connect(env.MONGO_URI);
  cases = client.db().collection("cases");
  caseSeries = client.db().collection("case_series");
});
afterAll(async () => {
  try {
    await client
      .db()
      .collection("config_versions")
      .deleteMany({ grantCode: renamedWorkflowCode });
  } finally {
    await client.close(true);
  }
});

beforeEach(async () => {
  await createAdminUser({
    idpRoles: [IdpRoles.Admin, IdpRoles.ReadWrite, IdpRoles.Read],
  });
  await createWorkflow();
});

const createCaseWithSeries = async (overrides = {}) => {
  const kase = await createCase(cases, overrides);
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

const verifyContextSurvivesSave = async (caseId, recordedContext) => {
  if (recordedContext === undefined) {
    return;
  }
  await wreck.post(`/cases/${caseId}/notes`, {
    payload: { text: "Save another case change" },
  });
  const saved = await cases.findOne({ _id: caseId });
  expect(
    saved.timeline.find((event) => event.eventType === "TASK_COMPLETED")
      .recordedContext,
  ).toEqual(recordedContext);
};

describe("case timeline descriptions", () => {
  it.each([
    ["Stored historic wording", undefined],
    [undefined, undefined],
    ["Stored historic wording", { taskName: "Incomplete older context" }],
  ])(
    "opens a case with a removed historical task group (description=%s, context=%j)",
    async (description, recordedContext) => {
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
      if (recordedContext !== undefined) {
        history.recordedContext = recordedContext;
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
      await verifyContextSurvivesSave(kase._id, recordedContext);
    },
  );

  it("renders a persisted historical name without exposing the recorded context", async () => {
    await createWorkflow({ code: renamedWorkflowCode });
    const kase = await createCaseWithSeries({
      workflowCode: renamedWorkflowCode,
    });
    await completeTask({
      caseId: kase._id,
      taskGroupCode: "APPLICATION_RECEIPT_TASKS",
      taskCode: "SIMPLE_REVIEW",
    });
    const stored = await cases.findOne({ _id: kase._id });
    expect(stored.timeline[0]).toMatchObject({
      recordedContext: { taskName: "Simple Review", isInput: false },
      description: "Task completed",
    });
    await createWorkflow(
      { code: renamedWorkflowCode, version: "1.0.1" },
      (workflow) => {
        workflow.phases[0].stages[0].taskGroups[0].tasks[0].name =
          "Renamed review";
      },
    );
    const response = await wreck.get(`/cases/${kase._id}`);
    expect(response.res.statusCode).toBe(200);
    expect(response.payload.data.currentConfigVersion).toBe("1.0.1");
    expect(response.payload.data.timeline[0].description).toBe(
      "Task 'Simple Review' completed",
    );
    expect(response.payload.data.timeline[0]).not.toHaveProperty(
      "recordedContext",
    );
  });
});
