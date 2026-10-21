import { describe, expect, it, vi } from "vitest";
import {
  AUDIT_TYPE,
  UNKNOWN_TYPE,
  auditTopicArn,
  isAuditTarget,
  labelForMissingType,
  typeLabel,
} from "./event-audit.js";

// Inlined rather than referencing the constant below: `vi.mock` is hoisted
// above every declaration in this file.
vi.mock("../common/config.js", () => ({
  config: {
    get: (key) =>
      key === "aws.sns.auditTopicArn"
        ? "arn:aws:sns:eu-west-2:000000000000:cw__sns__audit_topic_arn"
        : undefined,
  },
}));

const ARN = "arn:aws:sns:eu-west-2:000000000000:cw__sns__audit_topic_arn";
const OTHER_ARN =
  "arn:aws:sns:eu-west-2:000000000000:cw__sns__case_status_updated_fifo.fifo";
const A_TYPE = "cloud.defra.prd.fg-cw-backend.case.status.updated";

describe("auditTopicArn", () => {
  it("reads the topic write-audit-event.js addresses", () => {
    expect(auditTopicArn()).toBe(ARN);
  });
});

describe("isAuditTarget", () => {
  it("recognises the topic write-audit-event.js addresses", () => {
    expect(isAuditTarget(ARN)).toBe(true);
  });

  it.each([OTHER_ARN, "internal:message-bus", null, undefined, ""])(
    "does not recognise %p",
    (target) => {
      expect(isAuditTarget(target)).toBe(false);
    },
  );
});

describe("labelForMissingType", () => {
  it("labels an audit-addressed row", () => {
    expect(labelForMissingType(true)).toBe(AUDIT_TYPE);
  });

  it("labels anything else that recorded no type unknown", () => {
    expect(labelForMissingType(false)).toBe(UNKNOWN_TYPE);
  });

  it("reads the fact the caller resolved, whichever shape it came from", () => {
    expect(labelForMissingType(isAuditTarget(ARN))).toBe(AUDIT_TYPE);
    expect(labelForMissingType(isAuditTarget(OTHER_ARN))).toBe(UNKNOWN_TYPE);
  });
});

describe("typeLabel", () => {
  it("states a stored type, even on the audit topic", () => {
    expect(typeLabel(A_TYPE, false)).toBe(A_TYPE);
    expect(typeLabel(A_TYPE, true)).toBe(A_TYPE);
  });

  it.each([null, undefined, ""])("labels %p as audit or unknown", (stored) => {
    expect(typeLabel(stored, true)).toBe(AUDIT_TYPE);
    expect(typeLabel(stored, false)).toBe(UNKNOWN_TYPE);
  });
});

describe("with no audit topic configured", () => {
  it("recognises nothing as audit", async () => {
    vi.resetModules();
    vi.doMock("../common/config.js", () => ({
      config: { get: () => undefined },
    }));

    const unconfigured = await import("./event-audit.js");

    expect(unconfigured.auditTopicArn()).toBeNull();
    expect(unconfigured.isAuditTarget(ARN)).toBe(false);

    vi.doUnmock("../common/config.js");
    vi.resetModules();
  });
});
