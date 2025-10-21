import hapi from "@hapi/hapi";
import { ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Case } from "../models/case.js";
import { findCaseByIdUseCase } from "../use-cases/find-case-by-id.use-case.js";
import { findCaseByIdRoute } from "./find-case-by-id.route.js";

vi.mock("../use-cases/find-case-by-id.use-case.js");

describe("findCaseByIdRoute", () => {
  const authenticatedUserId = new ObjectId().toHexString();
  const mockAuthUser = {
    id: authenticatedUserId,
    idpId: new ObjectId().toHexString(),
    name: "Test User",
    email: "test.user@example.com",
    idpRoles: ["user"],
    appRoles: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

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
    caseMock.stages[0].name = "Stage 1";
    caseMock.stages[0].description = "Stage 1 description";
    caseMock.stages[0].taskGroups[0].description = "Task group description";
    caseMock.stages[0].taskGroups[0].tasks[0].name = "Task 1";
    caseMock.stages[0].taskGroups[0].tasks[0].description = "Task description";
    caseMock.stages[0].taskGroups[0].tasks[0].statusOptions = [];

    caseMock.stages[1].name = "Stage 2";
    caseMock.stages[1].description = "Stage 2 description";

    findCaseByIdUseCase.mockResolvedValueOnce(caseMock);

    const { statusCode, result } = await server.inject({
      method: "GET",
      url: `/cases/${caseId}`,
      auth: {
        strategy: "entra",
        credentials: {
          user: mockAuthUser,
        },
      },
    });

    expect(statusCode).toEqual(200);
    expect(result).toEqual(caseMock);
    expect(findCaseByIdUseCase).toHaveBeenCalledWith(caseId, mockAuthUser);
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
