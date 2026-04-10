import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { User } from "../../users/models/user.js";
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
    const user = User.createMock({
      idpRoles: ["FCP.Casework.Admin", "FCP.Casework.ReadWrite"],
    });
    const cases = [{}];

    findCasesUseCase.mockResolvedValue(cases);

    const { statusCode, result } = await server.inject({
      method: "GET",
      url: "/cases",
      auth: {
        strategy: "entra",
        credentials: {
          user,
        },
      },
    });

    expect(findCasesUseCase).toHaveBeenCalledWith({
      user,
      query: { direction: "forward" },
    });

    expect(statusCode).toEqual(200);
    expect(result.data).toEqual(cases);
    expect(result.header).toEqual({
      navItems: [
        { title: "Admin", href: "/admin" },
        { title: "Casework", href: "/cases" },
      ],
    });
  });

  it("accepts workflowCode sort query", async () => {
    const user = User.createMock({
      idpRoles: ["FCP.Casework.Admin", "FCP.Casework.ReadWrite"],
    });

    findCasesUseCase.mockResolvedValue([]);

    const { statusCode } = await server.inject({
      method: "GET",
      url: "/cases?workflowCode=asc",
      auth: {
        strategy: "entra",
        credentials: {
          user,
        },
      },
    });

    expect(findCasesUseCase).toHaveBeenCalledWith({
      user,
      query: { direction: "forward", workflowCode: "asc" },
    });
    expect(statusCode).toEqual(200);
  });

  it("accepts workflowCode descending sort query", async () => {
    const user = User.createMock({
      idpRoles: ["FCP.Casework.Admin", "FCP.Casework.ReadWrite"],
    });

    findCasesUseCase.mockResolvedValue([]);

    const { statusCode } = await server.inject({
      method: "GET",
      url: "/cases?workflowCode=desc",
      auth: {
        strategy: "entra",
        credentials: {
          user,
        },
      },
    });

    expect(findCasesUseCase).toHaveBeenCalledWith({
      user,
      query: { direction: "forward", workflowCode: "desc" },
    });
    expect(statusCode).toEqual(200);
  });
});
