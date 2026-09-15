import { describe, expect, it, vi } from "vitest";
import {
  AUDIT_EXCLUDE,
  AUDIT_INCLUDE,
  AUDIT_MODES,
  AUDIT_TARGET_FIELDS,
  AUDIT_TYPE,
  EVENT_TYPE_FIELDS,
  UNKNOWN_TYPE,
  auditClauses,
  auditGroupExpression,
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

describe("auditClauses", () => {
  it("adds no clause when audit records are included", () => {
    expect(auditClauses(AUDIT_INCLUDE, "target")).toEqual([]);
  });

  it("removes only the rows addressed at the audit topic", () => {
    expect(auditClauses(AUDIT_EXCLUDE, "target")).toEqual([
      { target: { $not: /(^|:)cw__sns__audit_topic_arn$/ } },
    ]);
  });

  it("adds no clause for the inbox, which has no target to filter on", () => {
    expect(auditClauses(AUDIT_EXCLUDE, AUDIT_TARGET_FIELDS.inbox)).toEqual([]);
  });

  it("uses the outbox's target field", () => {
    expect(auditClauses(AUDIT_EXCLUDE, AUDIT_TARGET_FIELDS.outbox)).toEqual([
      { target: { $not: /(^|:)cw__sns__audit_topic_arn$/ } },
    ]);
  });

  it("adds no clause for a mode it does not recognise", () => {
    expect(auditClauses(undefined, "target")).toEqual([]);
  });

  it("offers exactly the two modes the query schema validates", () => {
    expect(AUDIT_MODES).toEqual(["include", "exclude"]);
  });
});

describe("auditGroupExpression", () => {
  it("asks the breakdown's $group whether a row was audit-addressed", () => {
    expect(auditGroupExpression(AUDIT_TARGET_FIELDS.outbox)).toEqual({
      $eq: [
        { $arrayElemAt: [{ $split: ["$target", ":"] }, -1] },
        "cw__sns__audit_topic_arn",
      ],
    });
  });

  // `$literal` because `$group` refuses a pipeline containing a bare boolean.
  it("is a literal false for the inbox, which has no target", () => {
    expect(auditGroupExpression(AUDIT_TARGET_FIELDS.inbox)).toEqual({
      $literal: false,
    });
  });
});

describe("EVENT_TYPE_FIELDS", () => {
  it("points at where each box stores its CloudEvent type", () => {
    expect(EVENT_TYPE_FIELDS).toEqual({ inbox: "type", outbox: "event.type" });
  });
});

// The JavaScript predicate and the Mongo clause must answer identically for
// every shape a row takes, and narrow TOGETHER - so an "unknown" row is
// neither labelled audit nor filtered away.
describe("the audit label and the audit filter agree", () => {
  const removedByTheFilter = (target) =>
    typeof target === "string" && /(^|:)cw__sns__audit_topic_arn$/.test(target);

  const labelledAudit = (storedType, target) =>
    typeLabel(storedType, isAuditTarget(target)) === AUDIT_TYPE;

  it.each([
    ["an audit row", null, ARN],
    ["a type-less row on another topic", null, OTHER_ARN],
    ["a type-less row with no target at all", null, null],
    ["a row storing an empty type on the audit topic", "", ARN],
    ["a row storing an empty type elsewhere", "", OTHER_ARN],
  ])("agree on %s", (_name, storedType, target) => {
    expect(labelledAudit(storedType, target)).toBe(removedByTheFilter(target));
  });

  it("keeps an unknown row visible while naming it", () => {
    expect(typeLabel(null, isAuditTarget(OTHER_ARN))).toBe(UNKNOWN_TYPE);
    expect(removedByTheFilter(OTHER_ARN)).toBe(false);
  });

  // The clause and the predicate are built from the same topic name, so a
  // target the clause removes is exactly a target the label calls audit.
  it("filter and label are built from the one topic", () => {
    const [clause] = auditClauses(AUDIT_EXCLUDE, AUDIT_TARGET_FIELDS.outbox);

    expect(ARN).toMatch(clause.target.$not);
    expect(isAuditTarget(ARN)).toBe(true);
    expect(OTHER_ARN).not.toMatch(clause.target.$not);
    expect(isAuditTarget(OTHER_ARN)).toBe(false);
  });
});

describe("with no audit topic configured", () => {
  it("recognises nothing, removes nothing and groups nothing as audit", async () => {
    vi.resetModules();
    vi.doMock("../common/config.js", () => ({
      config: { get: () => undefined },
    }));

    const unconfigured = await import("./event-audit.js");

    expect(unconfigured.auditTopicArn()).toBeNull();
    expect(unconfigured.isAuditTarget(ARN)).toBe(false);
    expect(unconfigured.auditClauses(AUDIT_EXCLUDE, "target")).toEqual([]);
    expect(unconfigured.auditGroupExpression("target")).toEqual({
      $literal: false,
    });

    vi.doUnmock("../common/config.js");
    vi.resetModules();
  });
});
