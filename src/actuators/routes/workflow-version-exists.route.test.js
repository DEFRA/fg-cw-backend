import { beforeEach, describe, expect, it, vi } from "vitest";
import { workflowVersionExistsUseCase } from "../use-cases/workflow-version-exists.use-case.js";
import { workflowVersionExistsRoute } from "./workflow-version-exists.route.js";
import { serverFor } from "../../../test/helpers/case-route-server.js";

vi.mock("../use-cases/workflow-version-exists.use-case.js");
vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const URL = "/actuators/workflows/woodland/versions/1.2.0/existence";

const get = async (client, url = URL) =>
  (await serverFor(workflowVersionExistsRoute)).inject({
    method: "GET",
    url,
    headers: { "x-test-client": client },
  });

beforeEach(() => {
  workflowVersionExistsUseCase.mockResolvedValue({ exists: true });
});

describe("workflowVersionExistsRoute", () => {
  it("is a GET on the workflow version's existence", () => {
    expect(workflowVersionExistsRoute.method).toBe("GET");
    expect(workflowVersionExistsRoute.path).toBe(
      "/actuators/workflows/{code}/versions/{version}/existence",
    );
    expect(workflowVersionExistsRoute.options.auth).toBe("public-api");
  });

  it.each([true, false])(
    "answers exists: %s with no operator headers",
    async (exists) => {
      workflowVersionExistsUseCase.mockResolvedValue({ exists });

      const response = await get("fg-gas-backend");

      expect(response.statusCode).toBe(200);
      expect(response.result).toEqual({ exists });
      expect(workflowVersionExistsUseCase).toHaveBeenCalledWith({
        code: "woodland",
        version: "1.2.0",
      });
    },
  );

  it("is never stored by a cache", async () => {
    expect((await get("fg-gas-backend")).headers["cache-control"]).toBe(
      "no-store",
    );
  });

  it("answers 403 to any client but fg-gas-backend", async () => {
    expect((await get("fg-grants-platform-admin")).statusCode).toBe(403);
    expect(workflowVersionExistsUseCase).not.toHaveBeenCalled();
  });

  it("answers 400 on a version that is not a version number", async () => {
    const response = await get(
      "fg-gas-backend",
      "/actuators/workflows/woodland/versions/latest/existence",
    );

    expect(response.statusCode).toBe(400);
    expect(workflowVersionExistsUseCase).not.toHaveBeenCalled();
  });
});
