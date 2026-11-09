import hapi from "@hapi/hapi";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { User } from "../../users/models/user.js";
import { findCaseTypesUseCase } from "../use-cases/find-case-types.use-case.js";
import { findCaseTypesRoute } from "./find-case-types.route.js";

vi.mock("../use-cases/find-case-types.use-case.js");

vi.mock("../../common/write-audit-event.js", () => ({
  writeAuditEvent: vi.fn(),
}));

describe("findCaseTypesRoute", () => {
  let server;

  beforeAll(async () => {
    server = hapi.server();
    server.route(findCaseTypesRoute);
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("returns case types", async () => {
    const user = User.createMock({
      idpRoles: ["FCP.Casework.Admin", "FCP.Casework.ReadWrite"],
    });
    const caseTypes = [{ code: "woodland" }];

    findCaseTypesUseCase.mockResolvedValue(caseTypes);

    const { statusCode, result } = await server.inject({
      method: "GET",
      url: "/case-types",
      auth: {
        strategy: "entra",
        credentials: {
          user,
        },
      },
    });

    expect(findCaseTypesUseCase).toHaveBeenCalledWith({ user });

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [{ entity: "WORKFLOW", action: "VIEW_CASE_TYPE_LIST" }],
      }),
      undefined,
    );

    expect(statusCode).toEqual(200);
    expect(result.data).toEqual(caseTypes);
    expect(result.header).toEqual({
      navItems: [
        { title: "Admin", href: "/admin" },
        { title: "Casework", href: "/cases" },
      ],
    });
  });
});
