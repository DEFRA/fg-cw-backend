import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCase, completeTask, updateTaskValue } from "../helpers/cases.js";
import { changeUserAppRoles, createAdminUser } from "../helpers/users.js";
import { createWorkflow } from "../helpers/workflows.js";
import { wreck } from "../helpers/wreck.js";

describe("role requirements across the workflow hierarchy", () => {
  let client;
  let cases;

  beforeAll(async () => {
    client = await MongoClient.connect(env.MONGO_URI);
    cases = client.db().collection("cases");
  });

  afterAll(async () => {
    await client.close(true);
  });

  it("applies a task override while restricting its stage and other tasks", async () => {
    const user = await createAdminUser();
    await changeUserAppRoles(user, {
      ROLE_1: { startDate: "2025-01-01", endDate: "2100-01-01" },
    });
    await createWorkflow({}, (workflow) => {
      const phase = workflow.phases[0];
      const stage = phase.stages[0];
      phase.requiredRoles = { allOf: ["ROLE_3"], anyOf: [] };
      stage.requiredRoles = { allOf: ["ROLE_2"], anyOf: [] };
      stage.taskGroups[0].tasks[0].requiredRoles = {
        allOf: ["ROLE_1"],
        anyOf: [],
      };
    });
    const kase = await createCase(cases);
    const response = await wreck.get(`/cases/${kase._id}`);
    const stage = response.payload.data.stage;
    expect(stage.canPerformActions).toBe(false);
    expect(stage.taskGroups[0].tasks[0]).toMatchObject({
      requiredRoles: { allOf: ["ROLE_1"], anyOf: [] },
      canComplete: true,
    });
    expect(stage.taskGroups[1].tasks[0]).toMatchObject({
      requiredRoles: { allOf: ["ROLE_2"], anyOf: [] },
      canComplete: false,
    });
    await expect(
      wreck.patch(`/cases/${kase._id}/stage/outcome`, {
        payload: { actionCode: "APPROVE", comment: null },
      }),
    ).rejects.toThrow("403 Forbidden");
    await expect(
      updateTaskValue({
        caseId: kase._id,
        taskGroupCode: "REFERENCE_CAPTURE_TASKS",
        taskCode: "CAPTURE_TEXT",
        value: "SF123456",
      }),
    ).rejects.toThrow("403 Forbidden");
    const updated = await completeTask({
      caseId: kase._id,
      taskGroupCode: "APPLICATION_RECEIPT_TASKS",
      taskCode: "SIMPLE_REVIEW",
    });
    expect(updated.res.statusCode).toBe(204);
  });

  it("falls back to phase roles when stage and task roles are empty", async () => {
    const user = await createAdminUser();
    await changeUserAppRoles(user, {
      ROLE_3: { startDate: "2025-01-01", endDate: "2100-01-01" },
    });
    await createWorkflow({}, (workflow) => {
      const phase = workflow.phases[0];
      phase.requiredRoles = { allOf: ["ROLE_3"], anyOf: [] };
      phase.stages[0].requiredRoles = { allOf: [], anyOf: [] };
      phase.stages[0].taskGroups[0].tasks[0].requiredRoles = null;
    });
    const kase = await createCase(cases);
    const response = await wreck.get(`/cases/${kase._id}`);
    const stage = response.payload.data.stage;
    expect(stage.canPerformActions).toBe(true);
    expect(stage.taskGroups[0].tasks[0]).toMatchObject({
      requiredRoles: { allOf: ["ROLE_3"], anyOf: [] },
      canComplete: true,
    });
    const updated = await completeTask({
      caseId: kase._id,
      taskGroupCode: "APPLICATION_RECEIPT_TASKS",
      taskCode: "SIMPLE_REVIEW",
    });
    expect(updated.res.statusCode).toBe(204);
    await updateTaskValue({
      caseId: kase._id,
      taskGroupCode: "REFERENCE_CAPTURE_TASKS",
      taskCode: "CAPTURE_TEXT",
      value: "SF123456",
    });
    const outcome = await wreck.patch(`/cases/${kase._id}/stage/outcome`, {
      payload: { actionCode: "APPROVE", comment: null },
    });
    expect(outcome.res.statusCode).toBe(204);
  });
});
