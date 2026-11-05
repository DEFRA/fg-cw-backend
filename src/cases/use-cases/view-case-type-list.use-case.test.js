import { validateAuditEvent } from "@defra/fcp-audit-publisher";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditStatus } from "../../common/audit-constants.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { findCaseTypesUseCase } from "./find-case-types.use-case.js";
import {
  viewCaseTypeListAuditDataBuilder,
  viewCaseTypeListUseCase,
} from "./view-case-type-list.use-case.js";

vi.mock("./find-case-types.use-case.js");

vi.mock("../../common/write-audit-event.js", () => ({
  writeAuditEvent: vi.fn(),
}));

const user = {
  id: "507f1f77bcf86cd799439011",
  idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
  name: "Admin Test",
  email: "admin.test@example.com",
  idpRoles: ["FCP.Casework.Admin", "FCP.Casework.ReadWrite"],
};

describe("viewCaseTypeListUseCase", () => {
  beforeEach(() => {
    writeAuditEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the paged case type list response", async () => {
    const data = [{ code: "woodland" }, { code: "frps-private-beta" }];

    findCaseTypesUseCase.mockResolvedValue(data);

    const result = await viewCaseTypeListUseCase({ user });

    expect(findCaseTypesUseCase).toHaveBeenCalledWith({ user });
    expect(result.data).toEqual(data);
    expect(result.header).toBeDefined();
  });

  it("writes a VIEW_CASE_TYPE_LIST SUCCESS audit event with the actor's context", async () => {
    findCaseTypesUseCase.mockResolvedValue([]);

    await viewCaseTypeListUseCase({ user });

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [{ entity: "WORKFLOW", action: "VIEW_CASE_TYPE_LIST" }],
        details: {
          security: {
            actor: {
              id: user.id,
              idpId: user.idpId,
              name: user.name,
              email: user.email,
              idpRoles: user.idpRoles,
            },
          },
        },
        security: { pmccode: "0706" },
        segregationRef: `view-case-type-list-${user.id}`,
        status: auditStatus.SUCCESS,
      }),
      undefined,
    );
  });

  it("writes a FAILURE audit event when the use-case throws", async () => {
    const error = new Error("boom");

    findCaseTypesUseCase.mockRejectedValue(error);

    await expect(viewCaseTypeListUseCase({ user })).rejects.toThrow("boom");

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [{ entity: "WORKFLOW", action: "VIEW_CASE_TYPE_LIST" }],
        security: { pmccode: "0706" },
        status: auditStatus.FAILURE,
      }),
      null,
    );
  });
});

describe("viewCaseTypeListAuditDataBuilder", () => {
  it("builds an audit payload that passes audit validation", () => {
    const auditData = viewCaseTypeListAuditDataBuilder([{ user }]);

    const payload = {
      datetime: new Date().toISOString(),
      version: "1.0.0",
      application: "Case Working Service",
      component: "fg-cw-backend",
      environment: "dev",
      correlationid: "11111111-1111-1111-1111-111111111111",
      ip: "10.0.0.1",
      security: auditData.security,
      audit: {
        entities: auditData.entities,
        status: auditStatus.SUCCESS,
        details: auditData.details,
      },
    };

    const { valid } = validateAuditEvent(payload);

    expect(valid).toBe(true);
  });

  it("groups outbox rows by user via segregationRef", () => {
    const auditData = viewCaseTypeListAuditDataBuilder([{ user }]);

    expect(auditData.segregationRef).toBe(`view-case-type-list-${user.id}`);
  });
});
