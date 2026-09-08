import { escapeRegex } from "../common/escape-regex.js";
import { config } from "../common/config.js";

// What makes a row an audit record, said once, in both languages the actuators
// speak: JavaScript (the list projection's label) and Mongo (the list filter).
// Label and filter must stay on this one predicate, or the row the default
// page leaves out and the row labelled "audit" stop being the same row.
//
// Identified POSITIVELY, by where the row was addressed: `write-audit-event.js`
// is the only thing in this service that targets `aws.sns.auditTopicArn`. The
// absence of a CloudEvent type is a consequence, not the definition - other
// type-less rows exist and must stay visibly "unknown", not be called audit.
//
// The label strings mirror fg-gas-backend's events/event-audit.js verbatim:
// the admin events surface merges both services' rows into one list, and a
// label that read differently here would split one population in two.

export const AUDIT_TYPE = "audit";
export const UNKNOWN_TYPE = "unknown";

export const AUDIT_FULL_TYPE = "Audit record — not a CloudEvent";
export const UNKNOWN_FULL_TYPE = "No event type recorded — not a CloudEvent";

// Where each box stores the CloudEvent type, so the breakdown's `$group`, the
// detail projection and the list projection all read the same field.
export const EVENT_TYPE_FIELDS = { inbox: "type", outbox: "event.type" };

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

// Takes the RESOLVED audit fact, not a target: the list projection holds a
// stored target while the breakdown holds a flag Mongo computed in the
// `$group` key - one rule, so a group and its rows can never read differently.
export const labelForMissingType = (isAudit) =>
  isAudit ? AUDIT_TYPE : UNKNOWN_TYPE;

export const fullTypeForMissingType = (isAudit) =>
  isAudit ? AUDIT_FULL_TYPE : UNKNOWN_FULL_TYPE;

// `type` is the short label a list renders; `fullType` the long form a detail
// view shows when it differs. Never null in either field: every row states
// what it is, so a consumer merging these rows with another service's never
// has to guess on this service's behalf.
export const typeLabels = (storedType, isAudit) => ({
  type: storedType || labelForMissingType(isAudit),
  fullType: storedType || fullTypeForMissingType(isAudit),
});

export const AUDIT_INCLUDE = "include";
export const AUDIT_EXCLUDE = "exclude";

// Audit records are excluded by default (an operator is looking for work that
// moved or failed to move, not reads somebody did); "unknown" rows are NOT -
// they are anomalies and must stay visible. The default itself lives in the
// query schema: an HTTP contract states its own defaults.
export const AUDIT_MODES = [AUDIT_INCLUDE, AUDIT_EXCLUDE];

// The Mongo half of `isAuditTarget`. Narrow on purpose: it removes only rows
// addressed at the audit topic, so a type-less row that is not an audit record
// survives it. No clause for the inbox (no target field) and none when the
// audit topic is unconfigured - nothing identifiable, nothing removed.
const endsWithTopic = (name) => new RegExp(`(^|:)${escapeRegex(name)}$`);

export const auditClauses = (audit, targetField) => {
  const name = topicName(auditTopicArn());

  if (audit !== AUDIT_EXCLUDE || !targetField || !name) {
    return [];
  }

  return [{ [targetField]: { $not: endsWithTopic(name) } }];
};

// The `$group` key's audit flag: an audit group and an unknown one both group
// under a null type and must not be merged into one. The constant is
// `{ $literal: false }`, never a bare `false` - `$group` reads a bare boolean
// as an inclusion-style projection and refuses the whole pipeline.
export const auditGroupExpression = (targetField) => {
  const name = topicName(auditTopicArn());

  return targetField && name
    ? {
        $eq: [
          { $arrayElemAt: [{ $split: [`$${targetField}`, ":"] }, -1] },
          name,
        ],
      }
    : { $literal: false };
};
