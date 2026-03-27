import hapi from "@hapi/hapi";
import { ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { findCaseByIdUseCase } from "../use-cases/find-case-by-id.use-case.js";
import { findCaseSeries } from "../use-cases/find-case-series.use-case.js";
import { findCaseByIdRoute } from "./find-case-by-id.route.js";

vi.mock("../use-cases/find-case-by-id.use-case.js");
vi.mock("../use-cases/find-case-series.use-case.js");

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
    findCaseSeries.mockResolvedValueOnce({
      length: 1,
    });

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
    expect(result.data).toEqual({ ...kase, caseSeries: { length: 1 } });
    expect(result.header).toEqual({
      navItems: [],
    });
    expect(findCaseByIdUseCase).toHaveBeenCalledWith(caseId, mockAuthUser, {
      params: { caseId, tabId: undefined },
    });
  });

  it("returns a case with caseSeries data", async () => {
    const caseId = "60b8d295f1d2c916c8f0e6b7";
    const kase = {
      _id: caseId,
      links: [
        {
          id: "timeline",
          text: "Foo",
        },
      ],
    };

    findCaseByIdUseCase.mockResolvedValueOnce(kase);
    const mockSeries = {
      length: 2,
      seriesDetails: [
        {
          caseRef: "1234",
          dateReceived: new Date().toISOString(),
          closed: false,
          status: "In review",
          link: {
            href: "/",
            text: "View case",
          },
        },
        {
          caseRef: "5678",
          dateReceived: new Date().toISOString(),
          dateClosed: new Date().toISOString(),
          status: "Withdrawn",
          link: { text: "This case" },
        },
      ],
    };

    findCaseSeries.mockResolvedValueOnce(mockSeries);

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
    expect(result.data).toEqual({
      ...kase,
      links: [
        {
          id: "timeline",
          text: "Timeline (2)",
        },
      ],
      caseSeries: mockSeries,
    });
    expect(result.header).toEqual({
      navItems: [],
    });
    expect(findCaseByIdUseCase).toHaveBeenCalledWith(caseId, mockAuthUser, {
      params: { caseId, tabId: undefined },
    });
    expect(result.data.links[0].text).toBe("Timeline (2)");
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
