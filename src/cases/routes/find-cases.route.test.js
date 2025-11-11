import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer } from "../../server/index.js";
import { Case } from "../models/case.js";
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
    const cases = [Case.createMock(), Case.createMock()];
    cases[0].supplementaryData.agreements = [];
    cases[1].supplementaryData.agreements = [];

    cases[0].assignedUser.name = "Test Name 1";
    cases[1].assignedUser.name = "Test Name 1";

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
