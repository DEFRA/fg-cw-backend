import { MongoClient } from "mongodb";
import { env } from "node:process";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { IdpRoles } from "../../src/users/models/idp-roles.js";
import { completeTask, createCase, findCaseById } from "../helpers/cases.js";
import { receiveMessages } from "../helpers/sqs.js";
import {
  changeUserIdpRoles,
  createAdminUser,
  removeUserAppRoles,
} from "../helpers/users.js";
import { createWorkflow } from "../helpers/workflows.js";
import { wreck } from "../helpers/wreck.js";

describe("PATCH /cases/{caseId}/stage/outcome", () => {
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

  it("updates stage outcome and transitions to next stage", async () => {
    const kase = await createCase(cases);

    await completeTask({
      caseId: kase._id,
      taskGroupCode: "APPLICATION_RECEIPT_TASKS",
      taskCode: "SIMPLE_REVIEW",
    });

    const actionCode = "APPROVE";

    const response = await wreck.patch(`/cases/${kase._id}/stage/outcome`, {
      payload: {
        actionCode,
        comment: null,
      },
    });

    expect(response.res.statusCode).toBe(204);

    const updatedCase = await findCaseById(kase._id);
    expect(updatedCase.position.phaseCode).toBe("DEFAULT");
    expect(updatedCase.position.stageCode).toBe("CONTRACT");
    expect(updatedCase.position.statusCode).toBe("AWAITING_AGREEMENT");

    const timelineEntry = updatedCase.timeline[0];
    expect(timelineEntry.eventType).toBe("STAGE_COMPLETED");
    expect(timelineEntry.description).toBe("Stage completed");
    expect(timelineEntry.comment).toBeNull();
    expect(timelineEntry.createdBy).toBe(user.id);
    expect(timelineEntry.createdAt).toEqual(expect.any(String));
    expect(timelineEntry.data).toEqual({
      phaseCode: "DEFAULT",
      stageCode: "APPLICATION_RECEIPT",
      statusCode: "AWAITING_REVIEW",
      actionCode: "APPROVE",
    });

    await vi.waitFor(async () => {
      const caseStatusUpdatedEvents = await receiveMessages(
        env.GAS__SQS__UPDATE_STATUS,
      );

      expect(caseStatusUpdatedEvents).toEqual([
        {
          id: expect.any(String),
          traceparent: expect.any(String),
          type: "cloud.defra.local.fg-cw-backend.case.status.updated",
          datacontenttype: "application/json",
          source: "fg-cw-backend",
          specversion: "1.0",
          time: expect.any(String),
          data: {
            caseRef: expect.stringContaining("APPLICATION-REF-1"),
            currentStatus: "DEFAULT:CONTRACT:AWAITING_AGREEMENT",
            previousStatus: "DEFAULT:APPLICATION_RECEIPT:AWAITING_REVIEW",
            workflowCode: "frps-private-beta",
          },
        },
      ]);
    });
  });

  it("updates stage outcome with optional comment", async () => {
    const kase = await createCase(cases);

    await completeTask({
      caseId: kase._id,
      taskGroupCode: "APPLICATION_RECEIPT_TASKS",
      taskCode: "SIMPLE_REVIEW",
    });

    const commentText = "Application reviewed and approved";

    const response = await wreck.patch(`/cases/${kase._id}/stage/outcome`, {
      payload: {
        actionCode: "APPROVE",
        comment: commentText,
      },
    });

    expect(response.res.statusCode).toBe(204);

    const updatedCase = await findCaseById(kase._id);

    expect(updatedCase.timeline[0].comment.text).toBe(commentText);
  });

  it("returns 404 when case does not exist", async () => {
    const nonExistentCaseId = "507f1f77bcf86cd799439011";

    await expect(
      wreck.patch(`/cases/${nonExistentCaseId}/stage/outcome`, {
        payload: {
          actionCode: "APPROVE",
          comment: null,
        },
      }),
    ).rejects.toThrow("Response Error: 404 Not Found");
  });

  it("returns 400 for invalid case id format", async () => {
    const invalidCaseId = "invalid-case-id";

    await expect(
      wreck.patch(`/cases/${invalidCaseId}/stage/outcome`, {
        payload: {
          actionCode: "APPROVE",
          comment: null,
        },
      }),
    ).rejects.toThrow("Bad Request");
  });

  it("returns 403 when user does not have access", async () => {
    const kase = await createCase(cases);

    await completeTask({
      caseId: kase._id,
      taskGroupCode: "APPLICATION_RECEIPT_TASKS",
      taskCode: "SIMPLE_REVIEW",
    });

    await removeUserAppRoles(user);

    await expect(
      wreck.patch(`/cases/${kase._id}/stage/outcome`, {
        payload: {
          actionCode: "APPROVE",
          comment: null,
        },
      }),
    ).rejects.toThrow("Response Error: 403 Forbidden");
  });

  it("returns 404 for invalid action code", async () => {
    const kase = await createCase(cases);

    await completeTask({
      caseId: kase._id,
      taskGroupCode: "APPLICATION_RECEIPT_TASKS",
      taskCode: "SIMPLE_REVIEW",
    });

    await expect(
      wreck.patch(`/cases/${kase._id}/stage/outcome`, {
        payload: {
          actionCode: "INVALID_ACTION",
          comment: null,
        },
      }),
    ).rejects.toThrow("Response Error: 404 Not Found");
  });

  it("returns 400 when action code is missing", async () => {
    const kase = await createCase(cases);

    await expect(
      wreck.patch(`/cases/${kase._id}/stage/outcome`, {
        payload: {
          comment: null,
        },
      }),
    ).rejects.toThrow("Bad Request");
  });

  it("returns 412 when updating outcome for case in non-interactive stage", async () => {
    const kase = await createCase(cases);

    await expect(
      wreck.patch(`/cases/${kase._id}/stage/outcome`, {
        payload: {
          actionCode: "APPROVE",
          comment: null,
        },
      }),
    ).rejects.toThrow("Response Error: 412 Precondition Failed");
  });
});
