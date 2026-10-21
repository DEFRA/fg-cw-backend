import { config } from "../common/config.js";

// What makes a row an audit record, said once, for the detail label and the
// stamp backfill.
//
// Identified POSITIVELY, by where the row was addressed: `write-audit-event.js`
// is the only thing in this service that targets `aws.sns.auditTopicArn`. The
// absence of a CloudEvent type is a consequence, not the definition - other
// type-less rows exist and must stay visibly "unknown", not be called audit.
//
// The label strings mirror fg-gas-backend's events/event-audit.js verbatim, so
// an event reads the same on the admin surface whichever service holds it.

export const AUDIT_TYPE = "audit";
export const UNKNOWN_TYPE = "unknown";

// Only the outbox has a target - an inbox row carries no destination, so it
// can never be an audit record and a type-less one is always "unknown".
export const AUDIT_TARGET_FIELDS = { inbox: null, outbox: "target" };

// Read through a getter rather than captured at import time: suites mock
// `config` per test. Optional chaining because a partially mocked config is a
// normal thing in this repo.
const AUDIT_TOPIC_KEY = "aws.sns.auditTopicArn";

export const auditTopicArn = () => config?.get?.(AUDIT_TOPIC_KEY) ?? null;

// Compare topic NAMES (the segment after the last colon), never whole ARNs:
// the account id differs between environments and a database outlives the
// account that wrote into it, so a whole-ARN comparison mislabels every row
// written under any other account. The name is the identity - this service
// only ever reads its own database.
const topicName = (arn) =>
  typeof arn === "string" ? arn.slice(arn.lastIndexOf(":") + 1) : null;

export const isAuditTarget = (target) => {
  const name = topicName(auditTopicArn());

  return Boolean(name) && topicName(target) === name;
};

export const labelForMissingType = (isAudit) =>
  isAudit ? AUDIT_TYPE : UNKNOWN_TYPE;

// Never null: a consumer merging these rows with another service's never has
// to guess what a row is.
export const typeLabel = (storedType, isAudit) =>
  storedType || labelForMissingType(isAudit);
