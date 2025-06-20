import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { User } from "../models/user.js";
import { findUserByIdUseCase } from "../use-cases/find-user-by-id.use-case.js";
import { findUserByIdRoute } from "./find-user-by-id.route.js";

vi.mock("../use-cases/find-user-by-id.use-case.js");

describe("findUserByIdRoute", () => {
  let server;

  beforeAll(async () => {
    server = hapi.server();
    server.route(findUserByIdRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("returns a user matching userId", async () => {
    const caseId = "60b8d295f1d2c916c8f0e6b7";

    const caseMock = User.createMock();

    findUserByIdUseCase.mockResolvedValueOnce(caseMock);

    const { statusCode, result } = await server.inject({
      method: "GET",
      url: `/users/${caseId}`,
    });

    expect(statusCode).toEqual(200);
    expect(result).toEqual(caseMock);
    expect(findUserByIdUseCase).toHaveBeenCalledWith(caseId);
  });

  it("returns 400 when userId param is invalid", async () => {
    const { statusCode, result } = await server.inject({
      method: "GET",
      url: "/users/invalid-id",
    });

    expect(statusCode).toEqual(400);
    expect(result).toMatchObject({
      statusCode: 400,
      error: "Bad Request",
      message: "Invalid request params input",
    });
  });
});
