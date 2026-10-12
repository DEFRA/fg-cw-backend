import { beforeEach, describe, expect, it, vi } from "vitest";
import { caseExistsUseCase } from "../use-cases/case-exists.use-case.js";
import { caseExistsRoute } from "./case-exists.route.js";
import { serverFor } from "../../../test/helpers/case-route-server.js";

vi.mock("../use-cases/case-exists.use-case.js");
vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const URL = "/actuators/cases/frps/ref-1/existence";

const get = async (client) =>
  (await serverFor(caseExistsRoute)).inject({
    method: "GET",
    url: URL,
    headers: { "x-test-client": client },
  });

beforeEach(() => {
  caseExistsUseCase.mockResolvedValue({ exists: true });
});

describe("caseExistsRoute", () => {
  it("is a GET on the case's existence", () => {
    expect(caseExistsRoute.method).toBe("GET");
    expect(caseExistsRoute.path).toBe(
      "/actuators/cases/{workflowCode}/{caseRef}/existence",
    );
    expect(caseExistsRoute.options.auth).toBe("public-api");
  });

  it("answers yes or no with no operator headers", async () => {
    const response = await get("fg-gas-backend");

    expect(response.statusCode).toBe(200);
    expect(response.result).toEqual({ exists: true });
    expect(caseExistsUseCase).toHaveBeenCalledWith({
      workflowCode: "frps",
      caseRef: "ref-1",
    });
  });

  it("is never stored by a cache", async () => {
    expect((await get("fg-gas-backend")).headers["cache-control"]).toBe(
      "no-store",
    );
  });

  it("answers 403 to any client but fg-gas-backend", async () => {
    expect((await get("fg-grants-platform-admin")).statusCode).toBe(403);
    expect(caseExistsUseCase).not.toHaveBeenCalled();
  });
});
