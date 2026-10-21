import Boom from "@hapi/boom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auditStatus } from "./audit-constants.js";
import { auditedRead } from "./audited-read.js";
import { logger } from "./logger.js";
import { withTransaction } from "./with-transaction.js";
import { writeAuditEvent } from "./write-audit-event.js";

vi.mock("./logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("./with-transaction.js");
vi.mock("./write-audit-event.js");

const audit = {
  entities: [{ entity: "CASE", action: "VIEW_CASE_DATA", entityid: "ref" }],
  details: {},
  security: { pmccode: "0706" },
  segregationRef: "admin-view-case",
};

const buildAudit = vi.fn(() => audit);

beforeEach(() => {
  withTransaction.mockImplementation((run) => run("the-session"));
  writeAuditEvent.mockResolvedValue(undefined);
});

describe("auditedRead", () => {
  it("commits the SUCCESS audit before answering with the data", async () => {
    const order = [];
    const read = vi.fn(async () => {
      order.push("read");
      return { data: 1 };
    });
    writeAuditEvent.mockImplementation(async () => order.push("audit"));

    const result = await auditedRead(read, buildAudit)({ caseRef: "ref" });

    expect(result).toEqual({ data: 1 });
    expect(order).toEqual(["read", "audit"]);
    expect(buildAudit).toHaveBeenCalledWith({ caseRef: "ref" }, { data: 1 });
    expect(writeAuditEvent).toHaveBeenCalledWith(
      { ...audit, status: auditStatus.SUCCESS },
      "the-session",
    );
  });

  it("bounds the audit commit", async () => {
    await auditedRead(vi.fn(), buildAudit)({});

    expect(withTransaction).toHaveBeenCalledWith(expect.any(Function), {
      maxCommitTimeMS: 500,
    });
  });

  it("answers no data when the audit cannot be committed", async () => {
    writeAuditEvent.mockRejectedValue(new Error("Audit event failed"));

    await expect(
      auditedRead(vi.fn().mockResolvedValue({ data: 1 }), buildAudit)({}),
    ).rejects.toThrow("Audit event failed");
  });

  it("writes a FAILURE outside any session and rethrows the error", async () => {
    const notFound = Boom.notFound("Case not found");

    await expect(
      auditedRead(vi.fn().mockRejectedValue(notFound), buildAudit)({}),
    ).rejects.toBe(notFound);

    expect(buildAudit).toHaveBeenCalledWith({}, null, notFound);
    expect(writeAuditEvent).toHaveBeenCalledWith({
      ...audit,
      status: auditStatus.FAILURE,
    });
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("keeps the original error when the FAILURE audit is not written", async () => {
    const notFound = Boom.notFound("Case not found");
    writeAuditEvent.mockRejectedValue(new Error("outbox down"));

    await expect(
      auditedRead(vi.fn().mockRejectedValue(notFound), buildAudit)({}),
    ).rejects.toBe(notFound);
    expect(logger.error).toHaveBeenCalledWith(
      "Read FAILURE audit event not written",
    );
  });
});
