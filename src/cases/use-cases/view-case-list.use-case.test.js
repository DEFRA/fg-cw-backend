import { validateAuditEvent } from "@defra/fcp-audit-publisher";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditStatus } from "../../common/audit-constants.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { findCasesUseCase } from "./find-cases.use-case.js";
import {
  viewCaseListAuditDataBuilder,
  viewCaseListUseCase,
} from "./view-case-list.use-case.js";

vi.mock("./find-cases.use-case.js");

vi.mock("../../common/write-audit-event.js", () => ({
  writeAuditEvent: vi.fn(),
}));

const user = {
  id: "507f1f77bcf86cd799439011",
  idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
  name: "Bob Bill",
  email: "bob.bill@defra.gov.uk",
  idpRoles: ["FCP.Casework.ReadWrite"],
};

describe("viewCaseListUseCase", () => {
  beforeEach(() => {
    writeAuditEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the paged case list response", async () => {
    const query = { direction: "forward", createdAt: "desc" };
    const data = { pagination: {}, cases: [{ _id: "1" }] };

    findCasesUseCase.mockResolvedValue(data);

    const result = await viewCaseListUseCase({ user, query });

    expect(findCasesUseCase).toHaveBeenCalledWith({ user, query });
    expect(result.data).toEqual(data);
    expect(result.header).toBeDefined();
  });

  it("writes a VIEW_CASE_LIST SUCCESS audit event with the actor's context", async () => {
    const query = { direction: "forward", search: "12345" };

    findCasesUseCase.mockResolvedValue({ pagination: {}, cases: [] });

    await viewCaseListUseCase({ user, query });

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [{ entity: "CASE", action: "VIEW_CASE_LIST" }],
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
          query,
        },
        security: { pmccode: "0706" },
        messageGroupId: `view-case-list-${user.id}`,
        status: auditStatus.SUCCESS,
      }),
      undefined,
    );
  });

  it("writes a FAILURE audit event when the use-case throws", async () => {
    const query = { direction: "forward" };
    const error = new Error("boom");

    findCasesUseCase.mockRejectedValue(error);

    await expect(viewCaseListUseCase({ user, query })).rejects.toThrow("boom");

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [{ entity: "CASE", action: "VIEW_CASE_LIST" }],
        security: { pmccode: "0706" },
        status: auditStatus.FAILURE,
      }),
      null,
    );
  });
});

describe("viewCaseListAuditDataBuilder", () => {
  it("builds an audit payload that passes audit validation", () => {
    const query = { direction: "forward", createdAt: "desc" };

    const auditData = viewCaseListAuditDataBuilder([{ user, query }]);

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

  it("uses the user id for the messageGroupId", () => {
    const auditData = viewCaseListAuditDataBuilder([{ user, query: {} }]);

    expect(auditData.messageGroupId).toBe(`view-case-list-${user.id}`);
  });

  it("includes a top-level security object for SOC forwarding", () => {
    const auditData = viewCaseListAuditDataBuilder([{ user, query: {} }]);

    expect(auditData.security).toEqual({ pmccode: "0706" });
  });
});
