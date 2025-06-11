import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Case } from "../models/case.js";
import { findCasesUseCase } from "../use-cases/find-cases.use-case.js";
import { findCasesRoute } from "./find-cases.route.js";

vi.mock("../use-cases/find-cases.use-case.js");

describe("findCasesRoute", () => {
  let server;

  beforeAll(async () => {
    server = hapi.server();
    server.route(findCasesRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("returns cases", async () => {
    const cases = [Case.createMock(), Case.createMock()];

    findCasesUseCase.mockResolvedValue(cases);

    const { statusCode, result } = await server.inject({
      method: "GET",
      url: "/cases",
    });

    expect(statusCode).toEqual(200);
    expect(result).toEqual(cases);
  });
});
