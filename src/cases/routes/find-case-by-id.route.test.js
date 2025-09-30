import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Case } from "../models/case.js";
import { findCaseByIdUseCase } from "../use-cases/find-case-by-id.use-case.js";
import { findCaseByIdRoute } from "./find-case-by-id.route.js";

vi.mock("../use-cases/find-case-by-id.use-case.js");

describe("findCaseByIdRoute", () => {
  let server;

  beforeAll(async () => {
    server = hapi.server();
    server.route(findCaseByIdRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("returns a case matching caseId", async () => {
    const caseId = "60b8d295f1d2c916c8f0e6b7";

    const caseMock = Case.createMock();
    caseMock.supplementaryData.agreements = [];

    findCaseByIdUseCase.mockResolvedValueOnce(caseMock);

    const { statusCode, result } = await server.inject({
      method: "GET",
      url: `/cases/${caseId}`,
    });

    expect(statusCode).toEqual(200);
    expect(result).toEqual(caseMock);
    expect(findCaseByIdUseCase).toHaveBeenCalledWith(caseId);
  });

  it("returns 400 when caseId param is invalid", async () => {
    const { statusCode, result } = await server.inject({
      method: "GET",
      url: "/cases/invalid-id",
    });

    expect(statusCode).toEqual(400);
    expect(result).toMatchObject({
      statusCode: 400,
      error: "Bad Request",
      message: "Invalid request params input",
    });
  });
});
