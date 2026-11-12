import {
  auditActions,
  auditEntities,
  buildAuditSecurity,
} from "../../common/audit-constants.js";
import { buildOperatorSecurityContext } from "../../common/audit-security-context.js";
import { auditedRead } from "../../common/audited-read.js";
import { BUCKET_ID } from "../../common/buckets/bucket.js";
import { prepareQuery, runQuery } from "../../common/buckets/engine.js";
import { refuse } from "../../common/buckets/refusal.js";
import { findBucket } from "../../common/buckets/registry.js";
import { config } from "../../common/config.js";
import { logger } from "../../common/logger.js";
import { searchAuditOf } from "../../common/search/audit.js";

// What was asked and how it was read, never a filter value or the value
// searched for: that only as a keyed digest. Absent values are dropped from
// the audit event, so they need no default.
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
    actor: operator.name,
    actorId: operator.id,
    facts: query.asked,
    refKind: query.refKind,
    ...searchAuditOf(query, config.get("search.auditKey")),
    from: query.from,
    to: query.to,
    page: query.cursor ? "next" : "first",
    plan: query.plan.kind,
    resultCount: result?.rows.length,
    repeat,
  },
  security: buildAuditSecurity(auditActions.QUERY_BUCKET),
  segregationRef: "admin-query-bucket",
});

const auditedQuery = auditedRead(
  ({ bucket, query }) => runQuery(bucket, query),
  queryBucketAuditBuilder,
);

const bucketOf = (bucketId) => {
  const bucket = BUCKET_ID.test(bucketId) ? findBucket(bucketId) : undefined;

  if (!bucket) {
    throw refuse("UNKNOWN_BUCKET");
  }

  return bucket;
};

// Parsed before the read, so a refused request writes no audit.
export const queryBucketUseCase = async ({
  bucketId,
  body,
  operator,
  caller,
  repeat,
}) => {
  const bucket = bucketOf(bucketId);
  const query = await prepareQuery(bucket, body);

  logger.info(`Query bucket ${bucket.id}`);

  const result = bucket.audited
    ? await auditedQuery({ bucket, query, operator, caller, repeat })
    : await runQuery(bucket, query);

  logger.info(`Finished: Query bucket (${result.rows.length} rows)`);

  return result;
};
