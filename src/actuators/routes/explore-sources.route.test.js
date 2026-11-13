import { beforeEach, describe, expect, it, vi } from "vitest";
import { asGas, serverFor } from "../../../test/helpers/case-route-server.js";
import { exploreSourcesUseCase } from "../use-cases/explore-sources.use-case.js";
import { exploreSourcesRoute } from "./explore-sources.route.js";

vi.mock("../use-cases/explore-sources.use-case.js");
vi.mock("../../common/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const SOURCES = { versions: [2], sources: [] };

const get = async () =>
  (await serverFor(exploreSourcesRoute)).inject({
    method: "GET",
    url: "/actuators/explore/sources",
    headers: asGas(),
  });

beforeEach(() => {
  exploreSourcesUseCase.mockResolvedValue(SOURCES);
});

describe("exploreSourcesRoute", () => {
  it("is a GET on the public API", () => {
    expect(exploreSourcesRoute.method).toBe("GET");
    expect(exploreSourcesRoute.path).toBe("/actuators/explore/sources");
    expect(exploreSourcesRoute.options.auth).toBe("public-api");
  });

  it("answers the versions it reads and its sources", async () => {
    const response = await get();

    expect(response.statusCode).toBe(200);
    expect(response.result).toEqual(SOURCES);
  });

  it("answers 500 rather than a sources answer off its schema", async () => {
    exploreSourcesUseCase.mockResolvedValue({ versions: [2] });

    expect((await get()).statusCode).toBe(500);
  });
});
