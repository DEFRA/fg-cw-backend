import Boom from "@hapi/boom";
import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { workflowData1 } from "../../../test/fixtures/workflow.js";
import { IdpRoles } from "../../users/models/idp-roles.js";
import { workflowSchema } from "../schemas/workflow.schema.js";
import { createWorkflowUseCase } from "../use-cases/create-workflow.use-case.js";
import { createWorkflowRoute } from "./create-workflow.route.js";

vi.mock("../use-cases/create-workflow.use-case.js");

describe("createWorkflowRoute", () => {
  const mockAuthUser = {
    id: "user-123",
    idpRoles: [IdpRoles.Admin],
    appRoles: {},
  };

  let server;

  beforeAll(async () => {
    server = hapi.server();
    server.route(createWorkflowRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("creates a new workflow and returns no content", async () => {
    const { statusCode, result } = await server.inject({
      method: "POST",
      url: "/workflows",
      payload: workflowData1,
      auth: {
        strategy: "entra",
        credentials: {
          user: mockAuthUser,
          raw: {
            idpRoles: [IdpRoles.Admin],
          },
        },
      },
    });

    expect(statusCode).toEqual(204);

    expect(result).toEqual(null);

    expect(createWorkflowUseCase).toHaveBeenCalledWith({
      ...workflowData1,
      user: {
        ...mockAuthUser,
        idpRoles: [IdpRoles.Admin],
      },
    });
  });

  it("returns 403 when user is not authorised", async () => {
    createWorkflowUseCase.mockRejectedValue(Boom.forbidden("Access denied"));

    const { statusCode, result } = await server.inject({
      method: "POST",
      url: "/workflows",
      payload: workflowData1,
      auth: {
        strategy: "entra",
        credentials: {
          user: mockAuthUser,
          raw: {
            idpRoles: [],
          },
        },
      },
    });

    expect(statusCode).toEqual(403);
    expect(result).toEqual({
      statusCode: 403,
      error: "Forbidden",
      message: "Access denied",
    });
  });

  it("validates payload using createGrantRequestSchema", async () => {
    expect(createWorkflowRoute.options.validate.payload).toBe(
      workflowSchema.WorkflowData,
    );
  });

  it("returns 400 when payload is invalid", async () => {
    const { statusCode, result } = await server.inject({
      method: "POST",
      url: "/workflows",
      payload: {
        code: "test",
      },
    });

    expect(statusCode).toEqual(400);
    expect(result).toEqual({
      statusCode: 400,
      error: "Bad Request",
      message: "Invalid request payload input",
    });
  });
});
