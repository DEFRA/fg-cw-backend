import { casesBucket } from "../src/cases/buckets/cases.bucket.js";
import { inboxBucket } from "../src/cases/buckets/inbox.bucket.js";
import { outboxBucket } from "../src/cases/buckets/outbox.bucket.js";
import { caseStatusUpdated } from "../src/cases/events/case-status-updated.event.js";
import {
  caseCreate,
  caseUpdateStatus,
  configVersionUpdated,
} from "../src/cases/events/inbound-event-types.js";
import { ensureIndexes } from "../src/common/buckets/indexes.js";
import { logger } from "../src/common/logger.js";

// Built after the backfills, so they do not maintain the new indexes. The
// event types are named here so the box buckets are whole however this is run.
const declared = [
  caseCreate,
  caseStatusUpdated,
  caseUpdateStatus,
  configVersionUpdated,
];

const factories = [outboxBucket, inboxBucket, casesBucket];

export const up = async (db) => {
  logger.info(
    `Building bucket indexes for ${factories.length} buckets over ${declared.length} declared event types`,
  );

  for (const factory of factories) {
    await ensureIndexes(db, factory());
  }
};
