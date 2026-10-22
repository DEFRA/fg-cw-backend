import Boom from "@hapi/boom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { asGas, serverFor } from "../../../test/helpers/case-route-server.js";
import { operatorHeaders } from "../../../test/helpers/operator.js";
import { viewWorkflowVersionsUseCase } from "../use-cases/view-workflow-versions.use-case.js";
import { viewWorkflowVersionsRoute } from "./view-workflow-versions.route.js";

vi.mock("../use-cases/view-workflow-versions.use-case.js");
vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const get = async (url, headers = asGas()) =>
  (await serverFor(viewWorkflowVersionsRoute)).inject({
    method: "GET",
    url,
    headers,
  });

const ANSWER = {
  code: "Casework-Smoke",
  current: null,
  versions: [
    {
      version: "0.0.0",
      status: "draft",
      receivedAt: null,
      fetchStatus: "pending",
      stored: true,
    },
  ],
};

beforeEach(() => {
  viewWorkflowVersionsUseCase.mockResolvedValue(ANSWER);
});

describe("viewWorkflowVersionsRoute", () => {
  it("answers a workflow's versions by its code, upper case included", async () => {
    const response = await get("/actuators/workflows/Casework-Smoke/versions");

    expect(response.statusCode).toBe(200);
    expect(response.result).toEqual(ANSWER);
    expect(viewWorkflowVersionsUseCase).toHaveBeenCalledWith({
      code: "Casework-Smoke",
    });
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("answers 500 rather than a version without its stored state", async () => {
    const [entry] = ANSWER.versions;
    const { stored: _, ...unstated } = entry;
    viewWorkflowVersionsUseCase.mockResolvedValue({
      ...ANSWER,
      versions: [unstated],
    });

    expect(
      (await get("/actuators/workflows/woodland/versions")).statusCode,
    ).toBe(500);
  });

  it("answers 400 to a code with other characters", async () => {
    expect((await get("/actuators/workflows/a_b/versions")).statusCode).toBe(
      400,
    );
  });

  it("answers 400 without the operator", async () => {
    const response = await get("/actuators/workflows/woodland/versions", {
      "x-test-client": "fg-gas-backend",
    });

    expect(response.statusCode).toBe(400);
  });

  it("answers 403 to any client but fg-gas-backend", async () => {
    const response = await get("/actuators/workflows/woodland/versions", {
      "x-test-client": "test-client",
      ...operatorHeaders,
    });

    expect(response.statusCode).toBe(403);
    expect(viewWorkflowVersionsUseCase).not.toHaveBeenCalled();
  });

  it("passes the WORKFLOW_NOT_FOUND reason through on a 404", async () => {
    const error = Boom.notFound("Workflow not found");
    error.output.payload.reason = "WORKFLOW_NOT_FOUND";
    viewWorkflowVersionsUseCase.mockRejectedValue(error);

    const response = await get("/actuators/workflows/woodland/versions");

    expect(response.statusCode).toBe(404);
    expect(response.result.reason).toBe("WORKFLOW_NOT_FOUND");
  });
});
