import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer } from "../../server/index.js";
import { findCasesUseCase } from "../use-cases/find-cases.use-case.js";
import { findCasesRoute } from "./find-cases.route.js";

vi.mock("../use-cases/find-cases.use-case.js");

describe("findCasesRoute", () => {
  let server;

  beforeAll(async () => {
    server = await createServer();
    server.route(findCasesRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("returns cases", async () => {
    const cases = [{}];

    findCasesUseCase.mockResolvedValue(cases);

    const { statusCode, result } = await server.inject({
      method: "GET",
      url: "/cases",
      auth: {
        strategy: "entra",
        credentials: {
          userId: "12345",
          scope: ["admin"],
        },
      },
    });

    expect(statusCode).toEqual(200);
    expect(result).toEqual(cases);
  });
});
