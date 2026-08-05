import { validateAuditEvent } from "@defra/fcp-audit-publisher";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditStatus } from "../../common/audit-constants.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { buildCaseDetailsTabUseCase } from "./build-case-details-tab.use-case.js";
import {
  viewCaseTabAuditDataBuilder,
  viewCaseTabUseCase,
} from "./view-case-tab.use-case.js";

vi.mock("./build-case-details-tab.use-case.js");
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

describe("viewCaseTabUseCase", () => {
  beforeEach(() => {
    writeAuditEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the assembled tab page response", async () => {
    const tabId = "notes";
    buildCaseDetailsTabUseCase.mockResolvedValue({
      caseId,
      caseRef: "CASE-REF-1",
      tabId,
      content: [],
    });

    const result = await viewCaseTabUseCase({
      caseId,
      tabId,
      query: {},
      user,
    });

    expect(buildCaseDetailsTabUseCase).toHaveBeenCalledWith({
      params: { caseId, tabId },
      query: {},
      user,
    });
    expect(result.data.tabId).toBe(tabId);
    expect(result.header).toBeDefined();
  });

  it("writes a VIEW_CASE_TAB SUCCESS audit event with the tab id and actor", async () => {
    const tabId = "timeline";
    buildCaseDetailsTabUseCase.mockResolvedValue({
      caseId,
      caseRef: "CASE-REF-1",
      tabId,
      content: [],
    });

    await viewCaseTabUseCase({ caseId, tabId, query: {}, user });

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [
          { entity: "CASE", action: "VIEW_CASE_TAB", entityid: "CASE-REF-1" },
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
          tabId,
        },
        security: { pmccode: "0706" },
        segregationRef: `view-case-tab-${caseId}-${tabId}`,
        status: auditStatus.SUCCESS,
      }),
      undefined,
    );
  });

  it("writes a FAILURE audit event when the tab is not found", async () => {
    const tabId = "missing";
    buildCaseDetailsTabUseCase.mockRejectedValue(new Error("boom"));

    await expect(
      viewCaseTabUseCase({ caseId, tabId, query: {}, user }),
    ).rejects.toThrow("boom");

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [
          { entity: "CASE", action: "VIEW_CASE_TAB", entityid: caseId },
        ],
        security: { pmccode: "0706" },
        status: auditStatus.FAILURE,
      }),
      null,
    );
    const auditArg = writeAuditEvent.mock.calls[0][0];
    expect(auditArg.details.tabId).toBe(tabId);
  });
});

describe("viewCaseTabAuditDataBuilder", () => {
  it("builds an audit payload that passes audit validation", () => {
    const auditData = viewCaseTabAuditDataBuilder(
      [{ caseId, tabId: "case-details", user }],
      { data: { caseRef: "CASE-REF-1" } },
    );

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

  it("groups outbox rows by case and tab via segregationRef", () => {
    const auditData = viewCaseTabAuditDataBuilder(
      [{ caseId, tabId: "notes", user }],
      undefined,
    );

    expect(auditData.segregationRef).toBe(`view-case-tab-${caseId}-notes`);
  });

  it("sets no messageGroupId", () => {
    const auditData = viewCaseTabAuditDataBuilder(
      [{ caseId, tabId: "notes", user }],
      undefined,
    );

    expect(auditData).not.toHaveProperty("messageGroupId");
  });
});
