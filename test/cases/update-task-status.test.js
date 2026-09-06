import { MongoClient } from "mongodb";
import { env } from "node:process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { IdpRoles } from "../../src/users/models/idp-roles.js";
import {
  completeTask,
  createCase,
  findCaseById,
  updateTaskValue,
} from "../helpers/cases.js";
import {
  changeUserIdpRoles,
  createAdminUser,
  removeUserAppRoles,
} from "../helpers/users.js";
import { createWorkflow } from "../helpers/workflows.js";
import { wreck } from "../helpers/wreck.js";

describe("PATCH /cases/{caseId}/task-groups/{taskGroupCode}/tasks/{taskCode}/value", () => {
  let cases;
  let outbox;
  let client;
  let user;

  beforeAll(async () => {
    client = new MongoClient(env.MONGO_URI);
    await client.connect();
    cases = client.db().collection("cases");
    outbox = client.db().collection("outbox");
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

    expect(task.value).toBe("COMPLETE");
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
    await removeUserAppRoles(user);

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
        `/cases/${nonExistentCaseId}/task-groups/${taskGroupCode}/tasks/${taskCode}/value`,
        {
          payload: {
            value: "COMPLETE",
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
        `/cases/${invalidCaseId}/task-groups/${taskGroupCode}/tasks/${taskCode}/value`,
        {
          payload: {
            value: "COMPLETE",
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
        `/cases/${kase._id}/task-groups/${taskGroupCode}/tasks/${taskCode}/value`,
        {
          payload: {
            value: "INVALID_STATUS",
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
      phases: [
        {
          code: "DEFAULT",
          stages: [
            {
              code: "APPLICATION_RECEIPT",
              taskGroups: [
                {
                  code: "APPLICATION_RECEIPT_TASKS",
                  tasks: [
                    {
                      code: "SIMPLE_REVIEW",
                      value: "PENDING",
                      completed: false,
                    },
                  ],
                },
              ],
            },
            {
              code: "CONTRACT",
              taskGroups: [],
            },
          ],
        },
      ],
    });

    const taskGroupCode = "APPLICATION_RECEIPT_TASKS";
    const taskCode = "SIMPLE_REVIEW";

    await expect(
      wreck.patch(
        `/cases/${kase._id}/task-groups/${taskGroupCode}/tasks/${taskCode}/value`,
        {
          payload: {
            value: "COMPLETE",
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
        `/cases/${kase._id}/task-groups/${taskGroupCode}/tasks/${nonExistentTaskCode}/value`,
        {
          payload: {
            value: "COMPLETE",
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
        `/cases/${kase._id}/task-groups/${nonExistentTaskGroupCode}/tasks/${taskCode}/value`,
        {
          payload: {
            value: "COMPLETE",
            completed: true,
          },
        },
      ),
    ).rejects.toThrow();
  });

  it("writes an UPDATE_TASK_STATUS audit event to the outbox with the actor's security context", async () => {
    const kase = await createCase(cases);

    const response = await completeTask({
      caseId: kase._id,
      taskGroupCode: "APPLICATION_RECEIPT_TASKS",
      taskCode: "SIMPLE_REVIEW",
    });

    expect(response.res.statusCode).toBe(204);

    const outboxEntry = await outbox.findOne({
      "event.audit.entities.action": "UPDATE_TASK_STATUS",
    });

    expect(outboxEntry).toMatchObject({
      event: {
        audit: {
          entities: [
            {
              entity: "CASE",
              action: "UPDATE_TASK_STATUS",
              entityid: kase.caseRef,
            },
          ],
          status: "SUCCESS",
          details: {
            security: {
              actor: {
                id: expect.any(String),
                idpId: user.idpId,
                name: user.name,
                email: user.email,
                idpRoles: expect.arrayContaining([IdpRoles.ReadWrite]),
              },
            },
          },
        },
        security: { pmccode: "0706" },
      },
      target: expect.stringMatching(/^arn:aws:sns:eu-west-2:\d+:.*audit.*$/),
    });
  });

  describe("input tasks", () => {
    const taskGroupCode = "REFERENCE_CAPTURE_TASKS";

    const findInputTask = async (caseId, taskCode) => {
      const updatedCase = await findCaseById(caseId);
      const taskGroup = updatedCase.phases[0].stages[0].taskGroups.find(
        (group) => group.code === taskGroupCode,
      );

      return taskGroup.tasks.find((task) => task.code === taskCode);
    };

    it.each([
      ["CAPTURE_TEXT", "SF123456"],
      ["CAPTURE_NUMBER", "1200"],
      ["CAPTURE_DATE", "2026-03-27"],
    ])(
      "stores %s and infers completion from the value",
      async (taskCode, value) => {
        const kase = await createCase(cases);

        const response = await updateTaskValue({
          caseId: kase._id,
          taskGroupCode,
          taskCode,
          value,
        });

        expect(response.res.statusCode).toBe(204);

        const task = await findInputTask(kase._id, taskCode);
        expect(task.value).toBe(value);
        expect(task.completed).toBe(true);
        expect(task.updatedAt).toBeDefined();
      },
    );

    it.each([
      ["CAPTURE_TEXT", "TOOMANYCHARS"],
      ["CAPTURE_NUMBER", "0"],
      ["CAPTURE_NUMBER", "5001"],
      ["CAPTURE_NUMBER", "not-a-number"],
      // Number() reads these as 16 and 1000, but the value is stored as the
      // string typed, so the field would come back reading "0x10".
      ["CAPTURE_NUMBER", "0x10"],
      ["CAPTURE_NUMBER", "1e3"],
      // CAPTURE_NUMBER is integer-only, matching the pmf herd size field.
      ["CAPTURE_NUMBER", "12.5"],
      ["CAPTURE_DATE", "27-03-2026"],
      ["CAPTURE_DATE", "2026-02-30"],
    ])(
      "rejects %s value %s and leaves the task untouched",
      async (taskCode, value) => {
        const kase = await createCase(cases);

        await expect(
          updateTaskValue({
            caseId: kase._id,
            taskGroupCode,
            taskCode,
            value,
          }),
        ).rejects.toThrow("Response Error: 400 Bad Request");

        const task = await findInputTask(kase._id, taskCode);
        expect(task.value).toBeNull();
        expect(task.completed).toBe(false);
      },
    );

    // The route's valueSchema is Joi.string().allow(null), so "" is rejected
    // before the use case sees it - null is the only way to clear a value.
    it("un-completes the task when the value is cleared with null", async () => {
      const kase = await createCase(cases);
      const taskCode = "CAPTURE_TEXT";

      await updateTaskValue({
        caseId: kase._id,
        taskGroupCode,
        taskCode,
        value: "SF123456",
      });

      expect((await findInputTask(kase._id, taskCode)).completed).toBe(true);

      const response = await updateTaskValue({
        caseId: kase._id,
        taskGroupCode,
        taskCode,
        value: null,
      });

      expect(response.res.statusCode).toBe(204);

      const task = await findInputTask(kase._id, taskCode);
      expect(task.value).toBeNull();
      expect(task.completed).toBe(false);
    });

    it("trims surrounding whitespace before storing the value", async () => {
      const kase = await createCase(cases);

      const response = await updateTaskValue({
        caseId: kase._id,
        taskGroupCode,
        taskCode: "CAPTURE_TEXT",
        value: "  SF123456  ",
      });

      expect(response.res.statusCode).toBe(204);

      const task = await findInputTask(kase._id, "CAPTURE_TEXT");
      expect(task.value).toBe("SF123456");
      expect(task.completed).toBe(true);
    });

    // Blanks would persist as a value that redisplays as a filled-in field
    // against a task reading Incomplete.
    it("stores a whitespace-only value as null rather than as blanks", async () => {
      const kase = await createCase(cases);

      const response = await updateTaskValue({
        caseId: kase._id,
        taskGroupCode,
        taskCode: "CAPTURE_TEXT",
        value: "   ",
      });

      expect(response.res.statusCode).toBe(204);

      const task = await findInputTask(kase._id, "CAPTURE_TEXT");
      expect(task.value).toBeNull();
      expect(task.completed).toBe(false);
    });

    it("rejects an empty string value", async () => {
      const kase = await createCase(cases);

      await expect(
        updateTaskValue({
          caseId: kase._id,
          taskGroupCode,
          taskCode: "CAPTURE_TEXT",
          value: "",
        }),
      ).rejects.toThrow("Response Error: 400 Bad Request");
    });

    it("ignores a client-supplied completed flag", async () => {
      const kase = await createCase(cases);
      const taskCode = "CAPTURE_TEXT";

      await updateTaskValue({
        caseId: kase._id,
        taskGroupCode,
        taskCode,
        value: null,
        completed: true,
      });

      const task = await findInputTask(kase._id, taskCode);
      expect(task.completed).toBe(false);
    });

    it("returns the input definition and no valueOptions when reading the case", async () => {
      const kase = await createCase(cases);

      await client
        .db()
        .collection("case_series")
        .insertOne({
          caseRefs: [kase.caseRef],
          workflowCode: kase.workflowCode,
          latestCaseRef: kase.caseRef,
          latestCaseId: kase._id.toHexString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

      await updateTaskValue({
        caseId: kase._id,
        taskGroupCode,
        taskCode: "CAPTURE_NUMBER",
        value: "1200",
      });

      const { payload } = await wreck.get(`/cases/${kase._id}`);
      const taskGroup = payload.data.stage.taskGroups.find(
        (group) => group.code === taskGroupCode,
      );
      const task = taskGroup.tasks.find((t) => t.code === "CAPTURE_NUMBER");

      expect(task.input).toEqual({
        type: "number",
        label: "Herd size",
        min: 1,
        max: 5000,
        integer: true,
      });
      expect(task.valueOptions).toEqual([]);
      expect(task.value).toBe("1200");
      expect(task.statusText).toBe("Completed");
      expect(task.statusTheme).toBe("SUCCESS");
    });
  });
});
