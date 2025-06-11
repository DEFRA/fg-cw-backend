import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Workflow } from "../models/workflow.js";
import { findWorkflowsUseCase } from "../use-cases/find-workflows.use-case.js";
import { findWorkflowsRoute } from "./find-workflows.route.js";

vi.mock("../use-cases/find-workflows.use-case.js");

describe("findWorkflowsRoute", () => {
  let server;

  beforeAll(async () => {
    server = hapi.server();
    server.route(findWorkflowsRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("returns workflows", async () => {
    const workflows = [Workflow.createMock(), Workflow.createMock()];

    findWorkflowsUseCase.mockResolvedValue(workflows);

    const { statusCode, result } = await server.inject({
      method: "GET",
      url: "/workflows",
    });

    expect(statusCode).toEqual(200);
    expect(result).toEqual(workflows);
  });
});
