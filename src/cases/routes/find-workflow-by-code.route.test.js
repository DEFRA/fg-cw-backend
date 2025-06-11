import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Workflow } from "../models/workflow.js";
import { findWorkflowByCodeUseCase } from "../use-cases/find-workflow-by-code.use-case.js";
import { findWorkflowByCodeRoute } from "./find-workflow-by-code.route.js";

vi.mock("../use-cases/find-workflow-by-code.use-case.js");

describe("findWorkflowByCode", () => {
  let server;

  beforeAll(async () => {
    server = hapi.server();
    server.route(findWorkflowByCodeRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("returns a workflow matching code", async () => {
    const workflow = Workflow.createMock();

    findWorkflowByCodeUseCase.mockResolvedValueOnce(workflow);

    const { statusCode, result } = await server.inject({
      method: "GET",
      url: `/workflows/${workflow.code}`,
    });

    expect(statusCode).toEqual(200);
    expect(result).toEqual(workflow);
    expect(findWorkflowByCodeUseCase).toHaveBeenCalledWith(workflow.code);
  });

  it("returns 400 when code is invalid", async () => {
    const { statusCode, result } = await server.inject({
      method: "GET",
      url: "/workflows/AKJDNS",
    });

    expect(statusCode).toEqual(400);
    expect(result).toMatchObject({
      statusCode: 400,
      error: "Bad Request",
      message: "Invalid request params input",
    });
  });
});
