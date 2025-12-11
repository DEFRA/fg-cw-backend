import hapi from "@hapi/hapi";
import { ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { updateTaskStatusRequestSchema } from "../schemas/requests/update-task-status-request.schema.js";
import { updateTaskStatusUseCase } from "../use-cases/update-task-status.use-case.js";
import { updateTaskStatusRoute } from "./update-task-status.route.js";

vi.mock("../use-cases/update-task-status.use-case.js");

describe("updateTaskStatusRoute", () => {
  const authenticatedUserId = new ObjectId().toHexString();
  const mockAuthUser = {
    id: authenticatedUserId,
    idpId: new ObjectId().toHexString(),
    name: "Test User",
    email: "test.user@example.com",
    idpRoles: ["user"],
    appRoles: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  let server;

  beforeAll(async () => {
    server = hapi.server();
    server.route(updateTaskStatusRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("sets the status of a task", async () => {
    const caseId = "808b8c8f8c8f8c8f8c8f8c8f";
    const taskGroupCode = "APPLICATION_RECEIPT_TASKS";
    const taskCode = "SIMPLE_REVIEW";

    const { statusCode, result } = await server.inject({
      method: "PATCH",
      url: `/cases/${caseId}/task-groups/${taskGroupCode}/tasks/${taskCode}/status`,
      payload: {
        status: "COMPLETE",
        completed: true,
      },
      auth: {
        strategy: "entra",
        credentials: {
          user: mockAuthUser,
        },
      },
    });

    expect(statusCode).toEqual(204);

    expect(result).toEqual(null);

    expect(updateTaskStatusUseCase).toHaveBeenCalledWith({
      caseId,
      taskGroupCode,
      taskCode,
      status: "COMPLETE",
      completed: true,
      user: mockAuthUser,
    });
  });

  it("validates payload using updateTaskStatusRequestSchema", async () => {
    expect(updateTaskStatusRoute.options.validate.payload).toBe(
      updateTaskStatusRequestSchema,
    );
  });

  it("returns 400 when payload does not match schema", async () => {
    const caseId = "808b8c8f8c8f8c8f8c8f8c8f";
    const taskGroupCode = "APPLICATION_RECEIPT_TASKS";
    const taskCode = "SIMPLE_REVIEW";

    const { statusCode } = await server.inject({
      method: "PATCH",
      url: `/cases/${caseId}/task-groups/${taskGroupCode}/tasks/${taskCode}/status`,
      payload: {
        status: 999,
      },
    });

    expect(statusCode).toEqual(400);
  });
});
