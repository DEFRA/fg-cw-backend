import { ObjectId } from "mongodb";
import { config } from "../../common/config.js";
import {
  BREAKDOWN_TYPE_FIELDS,
  breakdownStages,
  toBreakdownGroups,
} from "../../common/event-breakdown.js";
import { toDetailDocument } from "../../common/event-detail.js";
import { toSourceFacets } from "../../common/event-facets.js";
import { buildEventListFilter } from "../../common/event-list-filter.js";
import {
  REDRIVE_FROM_STATUS,
  redriveUpdate,
} from "../../common/event-redrive.js";
import {
  claimExpiredAttempt,
  claimExpiredError,
  pushAttemptUpdate,
} from "../../common/last-error.js";
import { db } from "../../common/mongo-client.js";
import { paginate } from "../../common/paginate.js";
import { statusGroupStage } from "../../common/status-counts.js";
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
      // A sweep, not a model save: this rewrites many rows at once and never
      // loads an Inbox/Outbox, so the cap is applied by Mongo. `$slice: -10`
      // on the `$push` keeps the ten most recent entries per row.
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

// Move failed events to resubmitted status
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

// Move resubmitted events to published status
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
      // No `$inc` here. This is a state transition, not an attempt: the
      // counter is raised by `markAsFailed` when an attempt actually fails.
      // Incrementing here counted attempts GRANTED, which let the dead-letter
      // sweep below kill a row at the cap before its final attempt ran - the
      // "5/5 with four history entries" bug.
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

export const update = async (inbox) => {
  const document = inbox.toDocument();
  const { _id, ...updateDoc } = document;

  return db.collection(collection).updateOne({ _id }, { $set: updateDoc });
};

const orNull = (value) => value ?? null;

const toIsoOrNull = (value) =>
  value instanceof Date ? value.toISOString() : orNull(value);

// Rebuilt from the three contract keys rather than passed through: a stored
// `lastError` written by another version must never leak an extra key (a
// stack, say) past the response schema.
const toLastError = (value) =>
  value
    ? {
        name: String(value.name ?? "Error"),
        message: String(value.message ?? ""),
        at: toIsoOrNull(value.at),
      }
    : null;

// Rebuilt from its two contract keys, exactly as `lastError` is.
const toLastRedrive = (value) =>
  value ? { at: toIsoOrNull(value.at), by: orNull(value.by) } : null;

// The list projection, and the exact shape a redrive returns. Extracted from
// `findPage`'s `mapDocument` so a redriven row is byte-identical to the same
// row on the list page.
export const toListRow = (doc) => ({
  _id: doc._id.toHexString(),
  eventId: orNull(doc.messageId),
  type: orNull(doc.type),
  source: orNull(doc.source),
  segregationRef: orNull(doc.segregationRef),
  status: doc.status,
  completionAttempts: orNull(doc.completionAttempts),
  traceparent: orNull(doc.traceparent),
  createdAt: toIsoOrNull(doc.eventTime),
  lastFailureAt: toIsoOrNull(doc.lastResubmissionDate),
  lastError: toLastError(doc.lastError),
  completedAt: toIsoOrNull(doc.completionDate),
  // `{ at, by }` for the most recent redrive of this row, null until redriven.
  lastRedrive: toLastRedrive(doc.lastRedrive),
});

const inboxCursorCodecs = {
  eventTime: {
    encode: (v) => v,
    decode: (v) => v,
  },
  _id: {
    encode: (v) => v.toHexString(),
    decode: (v) => new ObjectId(v),
  },
};

// `eventTime` is the box's sort key AND its time-range field: it is a
// Z-normalised ISO string on every inbox document, so a string bound compares
// chronologically and needs no coercion.
const listFilter = ({ status, q, error, from, to }) =>
  buildEventListFilter({
    status,
    q,
    error,
    from,
    to,
    eventIdField: "messageId",
    traceparentField: "traceparent",
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
}) =>
  paginate(db.collection(collection), {
    filter: listFilter({ status, q, error, from, to }),
    cursor,
    direction,
    sort: { eventTime: -1, _id: -1 },
    pageSize,
    withTotal: false,
    codecs: inboxCursorCodecs,
    project: {
      _id: 1,
      messageId: 1,
      type: 1,
      source: 1,
      segregationRef: 1,
      status: 1,
      completionAttempts: 1,
      traceparent: 1,
      eventTime: 1,
      lastResubmissionDate: 1,
      completionDate: 1,
      lastError: 1,
      lastRedrive: 1,
    },
    mapDocument: toListRow,
  });

// How many rows sit in each status for the same selection the list would
// show, minus the cursor: the counts describe the whole filtered box, not one
// page. `status` is deliberately not a parameter - grouping BY status is the
// point. See common/status-counts.js for the accepted cost of the scan.
//
// This box's contribution to the counts endpoint: the status split for
// everything the operator asked for - see common/event-facets.js. GAS merges
// this with its own boxes' answers into the admin events filter bar.
export const countFacets = async (filter = {}) =>
  toSourceFacets(
    await db
      .collection(collection)
      .aggregate([{ $match: listFilter(filter) }, statusGroupStage()])
      .toArray(),
  );

const toId = (id) => ObjectId.createFromHexString(id);

// The whole stored document, minus the claim token, for one row. `null` when
// there is no such row - the route turns that into a 404.
export const findDetailById = async (id) => {
  const doc = await db
    .collection(collection)
    .findOne({ _id: toId(id) }, { projection: { claimedBy: 0 } });

  return doc ? toDetailDocument(doc, MAX_RETRIES) : null;
};

// Only used to tell a 404 from a 409 after a redrive matched nothing.
export const findStatusById = async (id) => {
  const doc = await db
    .collection(collection)
    .findOne({ _id: toId(id) }, { projection: { status: 1 } });

  return doc ? doc.status : null;
};

// A single conditional update: the DEAD_LETTER filter is the precondition, so
// a row that changed status between the read and the write simply matches
// nothing and the caller reports a 409 rather than clobbering it.
export const redriveById = async (id, { by } = {}) => {
  const doc = await db
    .collection(collection)
    .findOneAndUpdate(
      { _id: toId(id), status: REDRIVE_FROM_STATUS },
      redriveUpdate(InboxStatus.RESUBMITTED, { by }),
      { returnDocument: "after" },
    );

  return doc ? toListRow(doc) : null;
};

// How the dead letters in this box group by (failure message, event type).
// Scoped to DEAD_LETTER here rather than by the caller so the breakdown can
// never accidentally count a still-retrying row.
export const breakdown = async (filter = {}) =>
  toBreakdownGroups(
    await db
      .collection(collection)
      .aggregate(
        breakdownStages({
          filter: listFilter({ ...filter, status: REDRIVE_FROM_STATUS }),
          typeField: BREAKDOWN_TYPE_FIELDS.inbox,
          sortKey: "eventTime",
        }),
      )
      .toArray(),
  );
