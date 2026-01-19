import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { findAssigneesUseCase } from "../use-cases/find-assignees.use-case.js";
import { findAssigneesRoute } from "./find-assignees.route.js";

vi.mock("../use-cases/find-assignees.use-case.js");

describe("findAssigneesRoute", () => {
  let server;

  beforeAll(async () => {
    server = hapi.server();
    server.route(findAssigneesRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("returns assignees with minimal fields", async () => {
    findAssigneesUseCase.mockResolvedValue([
      { id: "543cd5d9a0812661c318fb24", name: "Alice Able" },
      { id: "5aaea69249c6d1beec839899", name: "Zara Zee" },
    ]);

    const { statusCode, result } = await server.inject({
      method: "GET",
      url: "/users/assignees",
    });

    expect(statusCode).toEqual(200);
    expect(result).toEqual([
      { id: "543cd5d9a0812661c318fb24", name: "Alice Able" },
      { id: "5aaea69249c6d1beec839899", name: "Zara Zee" },
    ]);
    expect(findAssigneesUseCase).toHaveBeenCalledWith({
      allAppRoles: [],
      anyAppRoles: [],
    });
  });

  it("passes role filters to findAssigneesUseCase", async () => {
    findAssigneesUseCase.mockResolvedValue([
      { id: "543cd5d9a0812661c318fb24", name: "Alice" },
    ]);

    const query = new URLSearchParams();
    query.append("allAppRoles", "ROLE_ONE");
    query.append("anyAppRoles", "ROLE_ANY");

    const response = await server.inject({
      method: "GET",
      url: `/users/assignees?${query}`,
    });

    if (response.statusCode !== 200) {
      throw new Error(
        JSON.stringify({
          statusCode: response.statusCode,
          payload: response.payload,
          result: response.result,
        }),
      );
    }

    expect(response.statusCode).toEqual(200);
    expect(findAssigneesUseCase).toHaveBeenCalledWith({
      allAppRoles: ["ROLE_ONE"],
      anyAppRoles: ["ROLE_ANY"],
    });

    expect(response.result).toEqual([
      { id: "543cd5d9a0812661c318fb24", name: "Alice" },
    ]);
  });
});
