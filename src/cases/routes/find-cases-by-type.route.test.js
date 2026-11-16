import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { User } from "../../users/models/user.js";
import { findCasesUseCase } from "../use-cases/find-cases.use-case.js";
import { findCasesByTypeRoute } from "./find-cases-by-type.route.js";

vi.mock("../use-cases/find-cases.use-case.js");

vi.mock("../../common/write-audit-event.js", () => ({
  writeAuditEvent: vi.fn(),
}));

describe("findCasesByTypeRoute", () => {
  let server;

  beforeAll(async () => {
    server = hapi.server();
    server.route(findCasesByTypeRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("returns cases for a given case type", async () => {
    const user = User.createMock({
      idpRoles: ["FCP.Casework.Admin", "FCP.Casework.ReadWrite"],
    });
    const cases = [{}];

    findCasesUseCase.mockResolvedValue(cases);

    const { statusCode, result } = await server.inject({
      method: "GET",
      url: "/types/woodland/cases",
      auth: {
        strategy: "entra",
        credentials: {
          user,
        },
      },
    });

    expect(findCasesUseCase).toHaveBeenCalledWith({
      user,
      query: { direction: "forward", caseType: "woodland" },
    });

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [{ entity: "CASE", action: "VIEW_CASE_LIST_BY_TYPE" }],
      }),
      undefined,
    );

    expect(statusCode).toEqual(200);
    expect(result.data).toEqual(cases);
    expect(result.header).toEqual({
      navItems: [
        { title: "Admin", href: "/admin" },
        { title: "Casework", href: "/cases" },
      ],
    });
  });

  it("accepts sort and search query parameters", async () => {
    const user = User.createMock({
      idpRoles: ["FCP.Casework.Admin", "FCP.Casework.ReadWrite"],
    });

    findCasesUseCase.mockResolvedValue([]);

    const { statusCode } = await server.inject({
      method: "GET",
      url: "/types/woodland/cases?search=12345&createdAt=desc",
      auth: {
        strategy: "entra",
        credentials: {
          user,
        },
      },
    });

    expect(findCasesUseCase).toHaveBeenCalledWith({
      user,
      query: {
        direction: "forward",
        caseType: "woodland",
        search: "12345",
        createdAt: "desc",
      },
    });
    expect(statusCode).toEqual(200);
  });

  it("returns 404 when caseType path param is missing", async () => {
    const user = User.createMock({
      idpRoles: ["FCP.Casework.Admin", "FCP.Casework.ReadWrite"],
    });

    const { statusCode } = await server.inject({
      method: "GET",
      url: "/types//cases",
      auth: {
        strategy: "entra",
        credentials: {
          user,
        },
      },
    });

    expect(statusCode).toEqual(404);
  });
});
