import {
  auditActions,
  auditEntities,
  buildAuditSecurity,
} from "../../common/audit-constants.js";
import { buildOperatorSecurityContext } from "../../common/audit-security-context.js";
import { auditedRead } from "../../common/audited-read.js";
import { BUCKET_ID } from "../../common/buckets/bucket.js";
import {
  parseQuery,
  readTimeoutMs,
  runQuery,
} from "../../common/buckets/engine.js";
import { refuse } from "../../common/buckets/refusal.js";
import { findBucket } from "../../common/buckets/registry.js";
import { logger } from "../../common/logger.js";

// As read: a ref search's plan is settled only once its rows are probed.
const planRead = (query, result) => result?.plan.kind ?? query.plan.kind;

// What was asked and how it was read, never a filter value or the ref searched
// for. Absent values are dropped from the audit event, so they need no default.
export const queryBucketAuditBuilder = (
  { bucket, query, operator, caller, repeat },
  result,
) => ({
  entities: [
    {
      entity: auditEntities.BUCKET,
      action: auditActions.QUERY_BUCKET,
      entityid: bucket.id,
    },
  ],
  details: {
    security: buildOperatorSecurityContext(operator),
    caller,
    facts: query.asked,
    refKind: query.refKind,
    from: query.from,
    to: query.to,
    page: query.cursor ? "next" : "first",
    plan: planRead(query, result),
    resultCount: result?.rows.length,
    repeat,
  },
  security: buildAuditSecurity(auditActions.QUERY_BUCKET),
  segregationRef: "admin-query-bucket",
});

const auditedQuery = auditedRead(
  ({ bucket, query, deadline }) => runQuery(bucket, query, deadline),
  queryBucketAuditBuilder,
);

const bucketOf = (bucketId) => {
  const bucket = BUCKET_ID.test(bucketId) ? findBucket(bucketId) : undefined;

  if (!bucket) {
    throw refuse("UNKNOWN_BUCKET");
  }

  return bucket;
};

// The caller's time counts from the read, and never past the cap.
const deadlineOf = (timeLeftMs) => {
  const cap = readTimeoutMs();

  return Date.now() + Math.min(timeLeftMs ?? cap, cap);
};

// Parsed before the read, so a refused request writes no audit.
export const queryBucketUseCase = async ({
  bucketId,
  body,
  operator,
  caller,
  repeat,
  timeLeftMs,
}) => {
  const bucket = bucketOf(bucketId);
  const query = parseQuery(bucket, body);

  const deadline = deadlineOf(timeLeftMs);

  logger.info(`Query bucket ${bucket.id}`);

  const result = bucket.audited
    ? await auditedQuery({ bucket, query, operator, caller, repeat, deadline })
    : await runQuery(bucket, query, deadline);

  logger.info(`Finished: Query bucket (${result.rows.length} rows)`);

  return result;
};
