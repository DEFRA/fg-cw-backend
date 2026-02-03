import Boom from "@hapi/boom";
import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildCaseDetailsTabUseCase } from "../use-cases/build-case-details-tab.use-case.js";
import { findCaseByIdTabIdRoute } from "./find-case-by-id-tab-id.route.js";

vi.mock("../use-cases/build-case-details-tab.use-case.js");

describe("findCaseByIdTabIdRoute", () => {
  const mockAuthUser = {
    id: "user-123",
    idpRoles: ["FCP.Casework.Admin", "FCP.Casework.ReadWrite"],
  };

  let server;

  beforeAll(async () => {
    server = hapi.server();
    server.route(findCaseByIdTabIdRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("returns tab data for valid caseId and tabId", async () => {
    const caseId = "60b8d295f1d2c916c8f0e6b7";
    const tabId = "case-details";

    const mockTabData = {
      caseId,
      caseRef: "TEST-REF-001",
      tabId,
      banner: {
        title: { text: "Test Case Banner", type: "string" },
        summary: {
          reference: {
            label: "Reference",
            text: "TEST-REF-001",
            type: "string",
          },
          scheme: { label: "Scheme", text: "SFI", type: "string" },
        },
      },
      links: [
        { id: "tasks", href: `/cases/${caseId}`, text: "Tasks" },
        { id: "notes", href: `/cases/${caseId}/notes`, text: "Notes" },
        {
          id: "case-details",
          href: `/cases/${caseId}/case-details`,
          text: "Application",
        },
      ],
      content: [
        {
          id: "title",
          component: "heading",
          text: "Application",
          level: 2,
        },
        {
          id: "answers",
          component: "list",
          title: "Answers",
          rows: [
            { text: "SFI", label: "Scheme" },
            { text: 2025, label: "Year" },
          ],
        },
      ],
      beforeContent: [],
    };

    buildCaseDetailsTabUseCase.mockResolvedValueOnce(mockTabData);

    const { statusCode, result } = await server.inject({
      method: "GET",
      url: `/cases/${caseId}/tabs/${tabId}`,
      auth: {
        strategy: "entra",
        credentials: {
          user: mockAuthUser,
        },
      },
    });

    expect(statusCode).toEqual(200);
    expect(result.data).toEqual(mockTabData);
    expect(result.header).toEqual({
      navItems: [
        { title: "Admin", href: "/admin" },
        { title: "Casework", href: "/cases" },
      ],
    });
    expect(buildCaseDetailsTabUseCase).toHaveBeenCalledWith({
      params: { caseId, tabId },
      query: {},
      user: mockAuthUser,
    });
  });

  it("returns 400 when caseId param is invalid", async () => {
    const { statusCode, result } = await server.inject({
      method: "GET",
      url: "/cases/invalid-id/tabs/case-details",
    });

    expect(statusCode).toEqual(400);
    expect(result).toMatchObject({
      statusCode: 400,
      error: "Bad Request",
      message: "Invalid request params input",
    });
  });

  it("returns 400 when tabId param is empty", async () => {
    const caseId = "60b8d295f1d2c916c8f0e6b7";

    const { statusCode, result } = await server.inject({
      method: "GET",
      url: `/cases/${caseId}/tabs/`,
    });

    expect(statusCode).toEqual(404);
    expect(result).toMatchObject({
      statusCode: 404,
      error: "Not Found",
    });
  });

  it("returns 404 when case is not found", async () => {
    const caseId = "60b8d295f1d2c916c8f0e6b7";
    const tabId = "case-details";

    buildCaseDetailsTabUseCase.mockRejectedValueOnce(
      Boom.notFound('Case with id "60b8d295f1d2c916c8f0e6b7" not found'),
    );

    const { statusCode, result } = await server.inject({
      method: "GET",
      url: `/cases/${caseId}/tabs/${tabId}`,
      auth: {
        strategy: "entra",
        credentials: {
          user: mockAuthUser,
        },
      },
    });

    expect(statusCode).toEqual(404);
    expect(result).toMatchObject({
      statusCode: 404,
      error: "Not Found",
      message: 'Case with id "60b8d295f1d2c916c8f0e6b7" not found',
    });
    expect(buildCaseDetailsTabUseCase).toHaveBeenCalledWith({
      params: { caseId, tabId },
      query: {},
      user: mockAuthUser,
    });
  });

  it("returns 404 when tab is not found in workflow", async () => {
    const caseId = "60b8d295f1d2c916c8f0e6b7";
    const tabId = "non-existent-tab";

    buildCaseDetailsTabUseCase.mockRejectedValueOnce(
      Boom.notFound(
        'Tab "non-existent-tab" not found in workflow "test-workflow"',
      ),
    );

    const { statusCode, result } = await server.inject({
      method: "GET",
      url: `/cases/${caseId}/tabs/${tabId}`,
      auth: {
        strategy: "entra",
        credentials: {
          user: mockAuthUser,
        },
      },
    });

    expect(statusCode).toEqual(404);
    expect(result).toMatchObject({
      statusCode: 404,
      error: "Not Found",
      message: 'Tab "non-existent-tab" not found in workflow "test-workflow"',
    });
    expect(buildCaseDetailsTabUseCase).toHaveBeenCalledWith({
      params: { caseId, tabId },
      query: {},
      user: mockAuthUser,
    });
  });

  it("returns 500 when use case throws unexpected error", async () => {
    const caseId = "60b8d295f1d2c916c8f0e6b7";
    const tabId = "case-details";

    buildCaseDetailsTabUseCase.mockRejectedValueOnce(
      new Error("Database connection failed"),
    );

    const { statusCode, result } = await server.inject({
      method: "GET",
      url: `/cases/${caseId}/tabs/${tabId}`,
      auth: {
        strategy: "entra",
        credentials: {
          user: mockAuthUser,
        },
      },
    });

    expect(statusCode).toEqual(500);
    expect(result).toMatchObject({
      statusCode: 500,
      error: "Internal Server Error",
      message: "An internal server error occurred",
    });
    expect(buildCaseDetailsTabUseCase).toHaveBeenCalledWith({
      params: { caseId, tabId },
      query: {},
      user: mockAuthUser,
    });
  });
});
