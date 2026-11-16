import { validateAuditEvent } from "@defra/fcp-audit-publisher";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditStatus } from "../../common/audit-constants.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { findCasesUseCase } from "./find-cases.use-case.js";
import {
  viewCaseListByTypeAuditDataBuilder,
  viewCaseListByTypeUseCase,
} from "./view-case-list-by-type.use-case.js";

vi.mock("./find-cases.use-case.js");

vi.mock("../../common/write-audit-event.js", () => ({
  writeAuditEvent: vi.fn(),
}));

const user = {
  id: "507f1f77bcf86cd799439011",
  idpId: "6a232710-1c66-4f8b-967d-41d41ae38478",
  name: "Casey Test",
  email: "casey.test@example.com",
  idpRoles: ["FCP.Casework.ReadWrite"],
};

describe("viewCaseListByTypeUseCase", () => {
  beforeEach(() => {
    writeAuditEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the paged case list response filtered by type", async () => {
    const query = { direction: "forward", caseType: "woodland" };
    const data = { pagination: {}, cases: [{ _id: "1" }] };

    findCasesUseCase.mockResolvedValue(data);

    const result = await viewCaseListByTypeUseCase({ user, query });

    expect(findCasesUseCase).toHaveBeenCalledWith({ user, query });
    expect(result.data).toEqual(data);
    expect(result.header).toBeDefined();
  });

  it("writes a VIEW_CASE_LIST_BY_TYPE SUCCESS audit event", async () => {
    const query = { direction: "forward", caseType: "woodland" };

    findCasesUseCase.mockResolvedValue({ pagination: {}, cases: [] });

    await viewCaseListByTypeUseCase({ user, query });

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [{ entity: "CASE", action: "VIEW_CASE_LIST_BY_TYPE" }],
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
        segregationRef: `view-case-list-by-type-${user.id}`,
        status: auditStatus.SUCCESS,
      }),
      undefined,
    );
  });

  it("writes a FAILURE audit event when the use-case throws", async () => {
    const query = { direction: "forward", caseType: "woodland" };
    const error = new Error("boom");

    findCasesUseCase.mockRejectedValue(error);

    await expect(viewCaseListByTypeUseCase({ user, query })).rejects.toThrow(
      "boom",
    );

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [{ entity: "CASE", action: "VIEW_CASE_LIST_BY_TYPE" }],
        security: { pmccode: "0706" },
        status: auditStatus.FAILURE,
      }),
      null,
    );
  });
});

describe("viewCaseListByTypeAuditDataBuilder", () => {
  it("builds an audit payload that passes audit validation", () => {
    const query = { direction: "forward", caseType: "woodland" };

    const auditData = viewCaseListByTypeAuditDataBuilder([{ user, query }]);

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
    const auditData = viewCaseListByTypeAuditDataBuilder([
      { user, query: { caseType: "woodland" } },
    ]);

    expect(auditData.segregationRef).toBe(`view-case-list-by-type-${user.id}`);
  });

  it("sets no messageGroupId", () => {
    const auditData = viewCaseListByTypeAuditDataBuilder([
      { user, query: { caseType: "woodland" } },
    ]);

    expect(auditData).not.toHaveProperty("messageGroupId");
  });

  it("includes a top-level security object for SOC forwarding", () => {
    const auditData = viewCaseListByTypeAuditDataBuilder([
      { user, query: { caseType: "woodland" } },
    ]);

    expect(auditData.security).toEqual({ pmccode: "0706" });
  });
});
