import hapi from "@hapi/hapi";
import { ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { assignUserToCaseRequestSchema } from "../schemas/requests/assign-user-to-case-request.schema.js";
import { assignUserToCaseUseCase } from "../use-cases/assign-user-to-case.use-case.js";
import { assignUserToCaseRoute } from "./assign-user-to-case.route.js";

vi.mock("../use-cases/assign-user-to-case.use-case.js");

describe("assignUserRoute", () => {
  let server;

  beforeAll(async () => {
    server = hapi.server();
    server.route(assignUserToCaseRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("assign user to case", async () => {
    const caseId = "808b8c8f8c8f8c8f8c8f8c8f";
    const assignedUserId = new ObjectId().toHexString();

    const { statusCode, result } = await server.inject({
      method: "PATCH",
      url: `/cases/${caseId}/assigned-user`,
      payload: {
        assignedUserId,
      },
    });

    expect(statusCode).toEqual(204);

    expect(result).toEqual(null);

    expect(assignUserToCaseUseCase).toHaveBeenCalledWith({
      caseId,
      assignedUserId,
    });
  });

  it("validates payload using assignUserToCaseRequestSchema", async () => {
    expect(assignUserToCaseRoute.options.validate.payload).toBe(
      assignUserToCaseRequestSchema,
    );
  });

  it("returns 400 when payload does not match schema", async () => {
    const caseId = "808b8c8f8c8f8c8f8c8f8c8f";

    const { statusCode } = await server.inject({
      method: "PATCH",
      url: `/cases/${caseId}/assigned-user`,
      payload: {},
    });

    expect(statusCode).toEqual(400);
  });
});
