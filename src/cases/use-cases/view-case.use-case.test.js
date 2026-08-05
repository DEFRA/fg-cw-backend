import { validateAuditEvent } from "@defra/fcp-audit-publisher";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditStatus } from "../../common/audit-constants.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { findCaseByIdUseCase } from "./find-case-by-id.use-case.js";
import { findCaseSeries } from "./find-case-series.use-case.js";
import {
  viewCaseAuditDataBuilder,
  viewCaseUseCase,
} from "./view-case.use-case.js";

vi.mock("./find-case-by-id.use-case.js");
vi.mock("./find-case-series.use-case.js");
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

const caseId = "60b8d295f1d2c916c8f0e6b7";

describe("viewCaseUseCase", () => {
  beforeEach(() => {
    writeAuditEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the assembled case page response", async () => {
    findCaseByIdUseCase.mockResolvedValue({
      caseRef: "CASE-REF-1",
      workflowCode: "wf-1",
      links: [{ id: "timeline", text: "Timeline" }],
    });
    findCaseSeries.mockResolvedValue({ length: 1 });

    const result = await viewCaseUseCase({ caseId, tabId: undefined, user });

    expect(findCaseByIdUseCase).toHaveBeenCalledWith(caseId, user, {
      params: { caseId, tabId: undefined },
    });
    expect(result.data.caseRef).toBe("CASE-REF-1");
    expect(result.data.caseSeries).toEqual({ length: 1 });
    expect(result.header).toBeDefined();
  });

  it("writes a VIEW_CASE SUCCESS audit event with the actor's context", async () => {
    findCaseByIdUseCase.mockResolvedValue({
      caseRef: "CASE-REF-1",
      workflowCode: "wf-1",
      links: [],
    });
    findCaseSeries.mockResolvedValue({ length: 1 });

    await viewCaseUseCase({ caseId, tabId: undefined, user });

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [
          { entity: "CASE", action: "VIEW_CASE", entityid: "CASE-REF-1" },
        ],
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
        segregationRef: `view-case-${caseId}`,
        status: auditStatus.SUCCESS,
      }),
      undefined,
    );
  });

  it("writes a FAILURE audit event when the use-case throws", async () => {
    findCaseByIdUseCase.mockRejectedValue(new Error("boom"));

    await expect(
      viewCaseUseCase({ caseId, tabId: undefined, user }),
    ).rejects.toThrow("boom");

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [{ entity: "CASE", action: "VIEW_CASE", entityid: caseId }],
        security: { pmccode: "0706" },
        status: auditStatus.FAILURE,
      }),
      null,
    );
  });
});

describe("viewCaseAuditDataBuilder", () => {
  it("builds an audit payload that passes audit validation", () => {
    const auditData = viewCaseAuditDataBuilder([{ caseId, user }], {
      data: { caseRef: "CASE-REF-1" },
    });

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

  it("groups outbox rows by case via segregationRef", () => {
    const auditData = viewCaseAuditDataBuilder([{ caseId, user }], undefined);

    expect(auditData.segregationRef).toBe(`view-case-${caseId}`);
  });

  it("sets no messageGroupId", () => {
    const auditData = viewCaseAuditDataBuilder([{ caseId, user }], undefined);

    expect(auditData).not.toHaveProperty("messageGroupId");
  });

  it("falls back to caseId for entityid when there is no result", () => {
    const auditData = viewCaseAuditDataBuilder([{ caseId, user }], undefined);

    expect(auditData.entities[0].entityid).toBe(caseId);
  });

  it.each(["tasks", "task", "notes", "timeline"])(
    "records the %s tab in the audit details so views are distinguishable",
    (tabId) => {
      const auditData = viewCaseAuditDataBuilder([{ caseId, tabId, user }], {
        data: { caseRef: "CASE-REF-1" },
      });

      expect(auditData.details.tabId).toBe(tabId);
    },
  );

  it("omits tabId from the details for the base case view", () => {
    const auditData = viewCaseAuditDataBuilder(
      [{ caseId, tabId: undefined, user }],
      { data: { caseRef: "CASE-REF-1" } },
    );

    expect(auditData.details.tabId).toBeUndefined();
  });
});
