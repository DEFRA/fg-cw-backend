import { beforeEach, describe, expect, it, vi } from "vitest";
import { asGas, serverFor } from "../../../test/helpers/case-route-server.js";
import { fetchWorkflowDefinitionUseCase } from "../use-cases/fetch-workflow-definition.use-case.js";
import { fetchWorkflowDefinitionRoute } from "./fetch-workflow-definition.route.js";

vi.mock("../use-cases/fetch-workflow-definition.use-case.js");
vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const post = async (url, headers = asGas()) =>
  (await serverFor(fetchWorkflowDefinitionRoute)).inject({
    method: "POST",
    url,
    headers,
  });

const FILES = {
  files: [{ file: "workflow", outcome: "failed", reason: "missing" }],
};

beforeEach(() => {
  fetchWorkflowDefinitionUseCase.mockResolvedValue(FILES);
});

describe("fetchWorkflowDefinitionRoute", () => {
  it("fetches for the operator GAS named, answering each file's outcome", async () => {
    const response = await post(
      "/actuators/workflows/Woodland/versions/2.0.0/fetch?by=Example%20Assignee",
    );

    expect(response.statusCode).toBe(200);
    expect(response.result).toEqual(FILES);
    expect(fetchWorkflowDefinitionUseCase).toHaveBeenCalledWith({
      grantCode: "Woodland",
      version: "2.0.0",
      by: "Example Assignee",
      caller: "fg-gas-backend",
    });
  });

  it.each([
    ["no operator", "/actuators/workflows/woodland/versions/2.0.0/fetch"],
    [
      "a blank operator",
      "/actuators/workflows/woodland/versions/2.0.0/fetch?by=",
    ],
  ])("answers 400 to %s, fetching nothing", async (_, url) => {
    expect((await post(url)).statusCode).toBe(400);
    expect(fetchWorkflowDefinitionUseCase).not.toHaveBeenCalled();
  });

  it("answers 403 to any client but fg-gas-backend", async () => {
    const response = await post(
      "/actuators/workflows/woodland/versions/2.0.0/fetch?by=Jane",
      { "x-test-client": "test-client" },
    );

    expect(response.statusCode).toBe(403);
    expect(fetchWorkflowDefinitionUseCase).not.toHaveBeenCalled();
  });
});
