import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { updateTaskStatusRequestSchema } from "../schemas/requests/update-task-status-request.schema.js";
import { updateTaskStatusUseCase } from "../use-cases/update-task-status.use-case.js";
import { updateTaskStatusRoute } from "./update-task-status.route.js";

vi.mock("../use-cases/update-task-status.use-case.js");

describe("updateTaskStatusRoute", () => {
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
    const stageCode = "application-receipt";
    const taskGroupId = "application-receipt-tasks";
    const taskId = "simple-review";

    const { statusCode, result } = await server.inject({
      method: "PATCH",
      url: `/cases/${caseId}/stages/${stageCode}/task-groups/${taskGroupId}/tasks/${taskId}/status`,
      payload: {
        status: "complete",
      },
    });

    expect(statusCode).toEqual(204);

    expect(result).toEqual(null);

    expect(updateTaskStatusUseCase).toHaveBeenCalledWith({
      caseId,
      stageCode,
      taskGroupId,
      taskId,
      status: "complete",
    });
  });

  it("validates payload using updateTaskStatusRequestSchema", async () => {
    expect(updateTaskStatusRoute.options.validate.payload).toBe(
      updateTaskStatusRequestSchema,
    );
  });

  it("returns 400 when payload does not match schema", async () => {
    const caseId = "808b8c8f8c8f8c8f8c8f8c8f";
    const stageCode = "application-receipt";
    const taskGroupId = "application-receipt-tasks";
    const taskId = "simple-review";

    const { statusCode } = await server.inject({
      method: "PATCH",
      url: `/cases/${caseId}/stages/${stageCode}/task-groups/${taskGroupId}/tasks/${taskId}/status`,
      payload: {
        status: "bang",
      },
    });

    expect(statusCode).toEqual(400);
  });
});
