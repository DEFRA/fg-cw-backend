import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { User } from "../../users/models/user.js";
import { reportCasesUseCase } from "../use-cases/report-cases.use-case.js";
import { reportCasesRoute } from "./report-cases.route.js";

vi.mock("../use-cases/report-cases.use-case.js");

const adminUser = () =>
  User.createMock({
    idpRoles: ["FCP.Casework.Admin", "FCP.Casework.ReadWrite"],
  });

const inject = (server, url, user) =>
  server.inject({
    method: "GET",
    url,
    auth: {
      strategy: "entra",
      credentials: { user },
    },
  });

describe("reportCasesRoute", () => {
  let server;

  beforeAll(async () => {
    server = hapi.server();
    server.route(reportCasesRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  // Given a caseworker requests the report with no case type
  // When the endpoint is called
  // Then the report data is returned inside the standard page envelope
  it("returns the report wrapped in a page response", async () => {
    const user = adminUser();
    const report = {
      selectedCaseType: "woodland",
      availableCaseTypes: ["frps", "woodland"],
      total: 7,
      phases: [],
    };

    reportCasesUseCase.mockResolvedValue(report);

    const { statusCode, result } = await inject(server, "/cases/report", user);

    expect(statusCode).toEqual(200);
    expect(reportCasesUseCase).toHaveBeenCalledWith({ user, query: {} });
    expect(result.data).toEqual(report);
    expect(result.header).toEqual({
      navItems: [
        { title: "Admin", href: "/admin" },
        { title: "Casework", href: "/cases" },
      ],
    });
  });

  // Given a caseworker selects a specific case type
  // When the endpoint is called with ?workflowCode
  // Then the selection is passed through to the use case
  it("passes the requested case type through to the use case", async () => {
    const user = adminUser();
    reportCasesUseCase.mockResolvedValue({
      selectedCaseType: "woodland",
      availableCaseTypes: ["woodland"],
      total: 0,
      phases: [],
    });

    const { statusCode } = await inject(
      server,
      "/cases/report?workflowCode=woodland",
      user,
    );

    expect(statusCode).toEqual(200);
    expect(reportCasesUseCase).toHaveBeenCalledWith({
      user,
      query: { workflowCode: "woodland" },
    });
  });

  // Regression (FGP-1221): the frontend's blank "Select a case type" option
  // submits workflowCode="" — this must be accepted as "no selection", not 400.
  it("accepts an empty workflowCode as no selection (does not reject with 400)", async () => {
    const user = adminUser();
    reportCasesUseCase.mockResolvedValue({
      selectedCaseType: null,
      availableCaseTypes: ["woodland"],
      total: 0,
      phases: [],
    });

    const { statusCode } = await inject(
      server,
      "/cases/report?workflowCode=",
      user,
    );

    expect(statusCode).toEqual(200);
    expect(reportCasesUseCase).toHaveBeenCalledWith({
      user,
      query: { workflowCode: "" },
    });
  });
});
