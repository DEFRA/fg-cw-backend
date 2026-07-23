import { validateAuditEvent } from "@defra/fcp-audit-publisher";
import { ObjectId } from "mongodb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditStatus } from "../../common/audit-constants.js";
import { writeAuditEvent } from "../../common/write-audit-event.js";
import { IdpRoles } from "../../users/models/idp-roles.js";
import { User } from "../../users/models/user.js";
import { Case } from "../models/case.js";
import { findById, update } from "../repositories/case.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";
import {
  addNoteToCaseAuditDataBuilder,
  addNoteToCaseUseCase,
} from "./add-note-to-case.use-case.js";

vi.mock("../repositories/case.repository.js");
vi.mock("../repositories/workflow.repository.js");
vi.mock("../../common/write-audit-event.js", () => ({
  writeAuditEvent: vi.fn(),
}));

const toAuditEvent = (auditData, status) => ({
  datetime: new Date().toISOString(),
  version: "1.0.0",
  application: "Case Working Service",
  component: "fg-cw-backend",
  environment: "test",
  correlationid: "test-correlation-id",
  ip: "10.0.0.1",
  security: auditData.security,
  audit: {
    entities: auditData.entities,
    status,
    details: auditData.details,
  },
});

describe("addNoteToCaseUseCase audit", () => {
  const userId = new ObjectId().toHexString();
  const mockUser = User.createMock({
    id: userId,
    idpRoles: [IdpRoles.ReadWrite],
  });

  beforeEach(() => {
    writeAuditEvent.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("writes an ADD_NOTE_TO_CASE audit event on success", async () => {
    const mockCase = Case.createMock();
    findById.mockResolvedValue(mockCase);
    findByCode.mockResolvedValue({});
    update.mockResolvedValue(mockCase);

    await addNoteToCaseUseCase({
      caseId: mockCase._id,
      text: "A note",
      user: mockUser,
    });

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entities: [
          {
            entity: "CASE",
            action: "ADD_NOTE_TO_CASE",
            entityid: mockCase._id,
          },
        ],
        security: { pmccode: "0706" },
        messageGroupId: `add-note-to-case-${mockCase._id}`,
        status: auditStatus.SUCCESS,
      }),
      undefined,
    );
    const auditArg = writeAuditEvent.mock.calls[0][0];
    expect(auditArg.details.security.actor.id).toBe(userId);
    expect(auditArg.details.note.ref).toBeDefined();
  });

  it("writes a FAILURE audit event when the case is not found", async () => {
    findById.mockResolvedValue(null);

    await addNoteToCaseUseCase({
      caseId: "missing",
      text: "A note",
      user: mockUser,
    }).catch(() => {});

    expect(writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: auditStatus.FAILURE }),
      null,
    );
  });

  it("produces a payload that passes audit validation", () => {
    const auditData = addNoteToCaseAuditDataBuilder(
      [{ caseId: "abc", user: mockUser }],
      { ref: "NOTE-1" },
    );

    const { valid } = validateAuditEvent(
      toAuditEvent(auditData, auditStatus.SUCCESS),
    );

    expect(valid).toBe(true);
  });
});
