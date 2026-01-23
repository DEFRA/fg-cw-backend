import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { IdpRoles } from "../../src/users/models/idp-roles.js";
import { completeTask, createCase, findCaseById } from "../helpers/cases.js";
import {
  changeUserIdpRoles,
  createAdminUser,
  removeUserAppRoles,
} from "../helpers/users.js";
import { createWorkflow } from "../helpers/workflows.js";
import { wreck } from "../helpers/wreck.js";

describe("PATCH /cases/{caseId}/task-groups/{taskGroupCode}/tasks/{taskCode}/status", () => {
  let cases;
  let client;
  let user;

  beforeAll(async () => {
    client = new MongoClient(env.MONGO_URI);
    await client.connect();
    cases = client.db().collection("cases");
  });

  afterAll(async () => {
    await client.close(true);
  });

  beforeEach(async () => {
    user = await createAdminUser();
    await createWorkflow();

    await changeUserIdpRoles(user, [IdpRoles.ReadWrite]);
  });

  it("updates task status successfully", async () => {
    const kase = await createCase(cases);
    const taskGroupCode = "APPLICATION_RECEIPT_TASKS";
    const taskCode = "SIMPLE_REVIEW";

    const response = await completeTask({
      caseId: kase._id,
      taskGroupCode,
      taskCode,
    });

    expect(response.res.statusCode).toBe(204);

    const updatedCase = await findCaseById(kase._id);
    const task = updatedCase.phases[0].stages[0].taskGroups[0].tasks[0];

    expect(task.status).toBe("COMPLETE");
    expect(task.completed).toBe(true);
    expect(task.updatedAt).toBeDefined();
  });

  it("updates task status with optional comment", async () => {
    const kase = await createCase(cases);
    const taskGroupCode = "APPLICATION_RECEIPT_TASKS";
    const taskCode = "SIMPLE_REVIEW";
    const commentText = "Task reviewed and approved";

    const response = await completeTask({
      caseId: kase._id,
      taskGroupCode,
      taskCode,
      comment: commentText,
    });

    expect(response.res.statusCode).toBe(204);

    const updatedCase = await findCaseById(kase._id);
    const comment = updatedCase.comments[0];

    expect(comment.text).toEqual("Task reviewed and approved");
  });

  it("returns 403 when user does not have ReadWrite role", async () => {
    await changeUserIdpRoles(user, [IdpRoles.Read]);

    const kase = await createCase(cases);

    await expect(
      completeTask({
        caseId: kase._id,
        taskGroupCode: "APPLICATION_RECEIPT_TASKS",
        taskCode: "SIMPLE_REVIEW",
      }),
    ).rejects.toThrow("Response Error: 403 Forbidden");
  });

  it("returns 403 when user does not have required task roles", async () => {
    await removeUserAppRoles(user.id);

    const kase = await createCase(cases);

    await expect(
      completeTask({
        caseId: kase._id,
        taskGroupCode: "APPLICATION_RECEIPT_TASKS",
        taskCode: "SIMPLE_REVIEW",
      }),
    ).rejects.toThrow("Response Error: 403 Forbidden");
  });

  it("returns 404 when case does not exist", async () => {
    const nonExistentCaseId = "507f1f77bcf86cd799439011";
    const taskGroupCode = "APPLICATION_RECEIPT_TASKS";
    const taskCode = "SIMPLE_REVIEW";

    await expect(
      wreck.patch(
        `/cases/${nonExistentCaseId}/task-groups/${taskGroupCode}/tasks/${taskCode}/status`,
        {
          payload: {
            status: "COMPLETE",
            completed: true,
          },
        },
      ),
    ).rejects.toThrow("Response Error: 404 Not Found");
  });

  it("returns 400 for invalid case id format", async () => {
    const invalidCaseId = "invalid-case-id";
    const taskGroupCode = "APPLICATION_RECEIPT_TASKS";
    const taskCode = "SIMPLE_REVIEW";

    await expect(
      wreck.patch(
        `/cases/${invalidCaseId}/task-groups/${taskGroupCode}/tasks/${taskCode}/status`,
        {
          payload: {
            status: "COMPLETE",
            completed: true,
          },
        },
      ),
    ).rejects.toThrow("Response Error: 400 Bad Request");
  });

  it("returns 400 for invalid status option", async () => {
    const kase = await createCase(cases);
    const taskGroupCode = "APPLICATION_RECEIPT_TASKS";
    const taskCode = "SIMPLE_REVIEW";

    await expect(
      wreck.patch(
        `/cases/${kase._id}/task-groups/${taskGroupCode}/tasks/${taskCode}/status`,
        {
          payload: {
            status: "INVALID_STATUS",
            completed: true,
          },
        },
      ),
    ).rejects.toThrow("Response Error: 400 Bad Request");
  });

  it("returns 400 when updating task on non-interactive stage", async () => {
    const kase = await createCase(cases, {
      position: {
        phaseCode: "DEFAULT",
        stageCode: "CONTRACT",
        statusCode: "AWAITING_AGREEMENT",
      },
      currentStage: "CONTRACT",
    });

    const taskGroupCode = "APPLICATION_RECEIPT_TASKS";
    const taskCode = "SIMPLE_REVIEW";

    await expect(
      wreck.patch(
        `/cases/${kase._id}/task-groups/${taskGroupCode}/tasks/${taskCode}/status`,
        {
          payload: {
            status: "COMPLETE",
            completed: true,
          },
        },
      ),
    ).rejects.toThrow("Response Error: 404 Not Found");
  });

  it("returns 400 when task code does not exist", async () => {
    const kase = await createCase(cases);
    const taskGroupCode = "APPLICATION_RECEIPT_TASKS";
    const nonExistentTaskCode = "NON_EXISTENT_TASK";

    await expect(
      wreck.patch(
        `/cases/${kase._id}/task-groups/${taskGroupCode}/tasks/${nonExistentTaskCode}/status`,
        {
          payload: {
            status: "COMPLETE",
            completed: true,
          },
        },
      ),
    ).rejects.toThrow();
  });

  it("returns 400 when task group code does not exist", async () => {
    const kase = await createCase(cases);
    const nonExistentTaskGroupCode = "NON_EXISTENT_TASK_GROUP";
    const taskCode = "SIMPLE_REVIEW";

    await expect(
      wreck.patch(
        `/cases/${kase._id}/task-groups/${nonExistentTaskGroupCode}/tasks/${taskCode}/status`,
        {
          payload: {
            status: "COMPLETE",
            completed: true,
          },
        },
      ),
    ).rejects.toThrow();
  });
});
