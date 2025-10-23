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
    cases[0].supplementaryData.agreements = [];
    cases[1].supplementaryData.agreements = [];
    cases.forEach((c) => {
      c.stages[0].name = "Stage 1";
      c.stages[0].description = "Stage 1 description";
      c.stages[1].name = "Stage 2";
      c.stages[1].description = "Stage 2 description";
      c.stages[0].taskGroups[0].description = "Task group description";
      c.stages[0].taskGroups[0].tasks[0].name = "Task 1";
      c.stages[0].taskGroups[0].tasks[0].description = [
        { component: "heading", level: 2, text: "Task description" },
      ];
      c.stages[0].taskGroups[0].tasks[0].statusOptions = [];
    });

    findCasesUseCase.mockResolvedValue(cases);

    const { statusCode, result } = await server.inject({
      method: "GET",
      url: "/cases",
    });

    expect(statusCode).toEqual(200);
    expect(result).toEqual(cases);
  });
});
