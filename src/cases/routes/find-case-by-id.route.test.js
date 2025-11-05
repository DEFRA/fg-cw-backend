import hapi from "@hapi/hapi";
import { ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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
    const kase = { _id: caseId };

    findCaseByIdUseCase.mockResolvedValueOnce(kase);

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
    expect(result).toEqual(kase);
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
