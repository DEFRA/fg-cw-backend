import { ObjectId } from "mongodb";
import { config } from "../../common/config.js";
import {
  AUDIT_TARGET_FIELDS,
  EVENT_TYPE_FIELDS,
  auditGroupExpression,
} from "../audit/event-audit.js";
import {
  breakdownStages,
  toBreakdownGroups,
} from "../breakdown/event-breakdown.js";
import { toSourceFacets } from "../counts/event-facets.js";
import { buildEventListFilter } from "../filter/event-list-filter.js";
import {
  REDRIVE_FROM_STATUS,
  redriveUpdate,
} from "../redrive/event-redrive.js";
import {
  claimExpiredAttempt,
  claimExpiredError,
  pushAttemptUpdate,
} from "../models/last-error.js";
import { db } from "../../common/mongo-client.js";
import { objectIdCodec, paginate, stringCodec } from "../../common/paginate.js";
import { statusGroupStage } from "../counts/status-counts.js";
import { Inbox, InboxStatus } from "../models/inbox.js";

const collection = "inbox";
const MAX_RETRIES = parseInt(config.get("inbox.inboxMaxRetries"));
const NUMBER_OF_RECORDS = parseInt(config.get("inbox.inboxClaimMaxRecords"));
const EXPIRES_IN_MS = parseInt(config.get("inbox.inboxExpiresMs"));

export const findNextMessage = async (lockIds) => {
  const doc = await db.collection(collection).findOne(
    {
      status: { $eq: InboxStatus.PUBLISHED },
      claimedBy: { $eq: null },
      completionAttempts: { $lt: MAX_RETRIES },
      segregationRef: { $nin: lockIds },
    },
    { sort: { eventTime: 1 } },
  );
  return doc;
};

export const claimEvents = async (
  claimedBy,
  segregationRef,
  numRecords = NUMBER_OF_RECORDS,
) => {
  const docs = [];

  for (let i = 0; i < numRecords; i++) {
    const document = await db.collection(collection).findOneAndUpdate(
      {
        status: { $eq: InboxStatus.PUBLISHED },
        claimedBy: { $eq: null },
        completionAttempts: { $lt: MAX_RETRIES },
        segregationRef,
      },
      {
        $set: {
          status: InboxStatus.PROCESSING,
          claimedBy,
          claimedAt: new Date(),
          claimExpiresAt: new Date(Date.now() + EXPIRES_IN_MS),
        },
      },
      { sort: { eventTime: 1 }, returnDocument: "after" },
    );
    docs.push(document);
  }

  const documents = docs.filter((d) => d !== null);
  return documents.map((doc) => Inbox.fromDocument(doc));
};

export const processExpiredEvents = async () => {
  await db.collection(collection).updateMany(
    {
      claimExpiresAt: { $lt: new Date() },
      status: { $nin: [InboxStatus.DEAD_LETTER, InboxStatus.COMPLETED] },
    },
    {
      $set: {
        status: InboxStatus.FAILED,
        // Nothing threw here - the claim simply outlived its holder - so the
        // sweep records itself as the reason.
        lastError: claimExpiredError(),
        claimedBy: null,
        claimedAt: null,
        claimExpiresAt: null,
      },
      // A sweep never loads the model, so the ten-entry history cap must be
      // applied by Mongo (`$slice` inside pushAttemptUpdate).
      $push: pushAttemptUpdate(claimExpiredAttempt()),
      // An expired claim IS a failed attempt, so it is counted in the same
      // operation that records it - see ATTEMPT ARITHMETIC in models/inbox.js.
      $inc: { completionAttempts: 1 },
    },
  );
};

export const updateDeadEvents = async () => {
  const results = await db.collection(collection).updateMany(
    {
      completionAttempts: { $gte: MAX_RETRIES },
      status: { $ne: InboxStatus.DEAD_LETTER },
    },
    {
      $set: {
        status: InboxStatus.DEAD_LETTER,
        claimedAt: null,
        claimExpiresAt: null,
        claimedBy: null,
      },
    },
  );
  return results;
};

export const updateFailedEvents = async () => {
  const results = await db.collection(collection).updateMany(
    {
      status: InboxStatus.FAILED,
    },
    {
      $set: {
        status: InboxStatus.RESUBMITTED,
        claimedAt: null,
        claimExpiresAt: null,
        claimedBy: null,
      },
    },
  );
  return results;
};

export const updateResubmittedEvents = async () => {
  const results = await db.collection(collection).updateMany(
    {
      status: InboxStatus.RESUBMITTED,
    },
    {
      $set: {
        status: InboxStatus.PUBLISHED,
        claimedAt: null,
        claimExpiresAt: null,
        claimedBy: null,
      },
      // No `$inc`: a state transition is not an attempt - the counter is
      // raised by `markAsFailed` (ATTEMPT ARITHMETIC, models/inbox.js).
    },
  );
  return results;
};

export const insertMany = async (events, session) => {
  return db.collection(collection).insertMany(
    events.map((event) => event.toDocument()),
    { session },
  );
};

export const findByMessageId = async (messageId) => {
  const doc = db.collection(collection).findOne({ messageId });
  return doc;
};

export const insertOne = async (inbox, session) => {
  return db.collection(collection).insertOne(inbox.toDocument(), { session });
};

// Guarded by the claim, as the outbox has always been.
//
// This writes the whole in-memory document, so a handler that outlived its
// claim used to overwrite whatever happened while it was stalled: the expiry
// sweep marks the row FAILED, increments the attempt count and pushes a
// `ClaimExpired` history entry, and the late write put its own stale copy back
// - erasing the increment and the entry, and possibly a second worker's fresh
// claim. Harmless while nothing read those numbers; this surface reads them.
//
// Matching on `claimedBy` makes the write a no-op for a handler that no longer
// holds the claim. The caller says so rather than assuming it succeeded.
export const update = async (inbox, claimedBy) => {
  const document = inbox.toDocument();
  const { _id, ...updateDoc } = document;

  return db
    .collection(collection)
    .updateOne({ _id, claimedBy }, { $set: updateDoc });
};

const inboxCursorCodecs = { eventTime: stringCodec, _id: objectIdCodec };

const domainProjection = {
  _id: 1,
  publicationDate: 1,
  traceparent: 1,
  messageId: 1,
  type: 1,
  source: 1,
  event: 1,
  status: 1,
  completionAttempts: 1,
  eventTime: 1,
  lastResubmissionDate: 1,
  completionDate: 1,
  lastError: 1,
  attemptHistory: 1,
  lastRedrive: 1,
  claimedAt: 1,
  claimExpiresAt: 1,
  segregationRef: 1,
};

// `eventTime` is the box's sort key AND its time-range field: it is a
// Z-normalised ISO string on every inbox document, so a string bound compares
// chronologically and needs no coercion.
const listFilter = ({ status, q, error, from, to, audit }) =>
  buildEventListFilter({
    status,
    q,
    error,
    from,
    to,
    // Accepted for symmetry of query surface with the outbox; with no target
    // field to compare, it never removes an inbox row.
    audit,
    eventIdField: "messageId",
    traceparentField: "traceparent",
    targetField: AUDIT_TARGET_FIELDS.inbox,
    rangeField: "eventTime",
    rangeIsDate: false,
  });

export const findPage = ({
  cursor,
  direction,
  pageSize,
  status,
  q,
  error,
  from,
  to,
  audit,
}) =>
  paginate(db.collection(collection), {
    filter: listFilter({ status, q, error, from, to, audit }),
    cursor,
    direction,
    sort: { eventTime: -1, _id: -1 },
    pageSize,
    withTotal: false,
    codecs: inboxCursorCodecs,
    project: domainProjection,
    mapDocument: Inbox.fromDocument,
  });

// The status split for the whole filtered box, not one page - no cursor, so
// the figures do not move as the operator pages. `status` is deliberately not
// a parameter: grouping BY status is the point. See
// events/counts/status-counts.js for the accepted cost of the scan.
export const countFacets = async (filter = {}) =>
  toSourceFacets(
    await db
      .collection(collection)
      .aggregate([{ $match: listFilter(filter) }, statusGroupStage()])
      .toArray(),
  );

const toId = (id) => ObjectId.createFromHexString(id);

// Null when there is no such row - the route turns that into a 404.
export const findDetailById = async (id) => {
  const doc = await db
    .collection(collection)
    .findOne({ _id: toId(id) }, { projection: { claimedBy: 0 } });

  return doc ? Inbox.fromDocument(doc) : null;
};

// Only used to tell a 404 from a 409 after a redrive matched nothing.
// `session` joins the caller's transaction where there is one, so the status
// this reads is the one that transaction can see - the redrive's own failed
// match and this follow-up read must not disagree about the row.
export const findStatusById = async (id, session) => {
  const doc = await db
    .collection(collection)
    .findOne({ _id: toId(id) }, { projection: { status: 1 }, session });

  return doc ? doc.status : null;
};

// A single conditional update: the DEAD_LETTER filter is the precondition, so
// a row that changed status between the read and the write simply matches
// nothing and the caller reports a 409 rather than clobbering it.
// `session` joins the caller's transaction where there is one, so the row's
// update and the audit event's outbox insert commit together or not at all.
export const redriveById = async (id, { by, session } = {}) => {
  const doc = await db
    .collection(collection)
    .findOneAndUpdate(
      { _id: toId(id), status: REDRIVE_FROM_STATUS },
      redriveUpdate(InboxStatus.RESUBMITTED, { by }),
      { returnDocument: "after", projection: domainProjection, session },
    );

  return doc ? Inbox.fromDocument(doc) : null;
};

// Scoped to DEAD_LETTER here rather than by the caller, so the breakdown can
// never count a still-retrying row.
export const breakdown = async (filter = {}) =>
  toBreakdownGroups(
    await db
      .collection(collection)
      .aggregate(
        breakdownStages({
          filter: listFilter({ ...filter, status: REDRIVE_FROM_STATUS }),
          typeField: EVENT_TYPE_FIELDS.inbox,
          auditExpression: auditGroupExpression(AUDIT_TARGET_FIELDS.inbox),
          sortKey: "eventTime",
        }),
      )
      .toArray(),
  );
