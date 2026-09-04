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
  PARK_FROM_STATUS,
  UNPARK_FROM_STATUS,
  parkUpdate,
  unparkUpdate,
} from "../../common/event-park.js";
import {
  REDRIVE_FROM_STATUS,
  redriveUpdate,
} from "../../common/event-redrive.js";
import {
  claimExpiredAttempt,
  claimExpiredError,
  pushAttemptUpdate,
} from "../../common/last-error.js";
import { logger } from "../../common/logger.js";
import { db } from "../../common/mongo-client.js";
import { paginate } from "../../common/paginate.js";
import { statusGroupStage } from "../../common/status-counts.js";
import { Outbox, OutboxStatus } from "../models/outbox.js";

const collection = "outbox";

const MAX_RETRIES = parseInt(config.get("outbox.outboxMaxRetries"));
const EXPIRES_IN_MS = parseInt(config.get("outbox.outboxExpiresMs"));
const NUMBER_OF_RECORDS = parseInt(config.get("outbox.outboxClaimMaxRecords"));

export const findNextMessage = async (lockIds) => {
  const doc = await db.collection(collection).findOne(
    {
      status: { $eq: OutboxStatus.PUBLISHED },
      claimedBy: { $eq: null },
      completionAttempts: { $lt: MAX_RETRIES },
      segregationRef: { $nin: lockIds },
    },
    { sort: { publicationDate: 1 } },
  );
  return doc;
};

export const claimEvents = async (claimedBy, segregationRef) => {
  const docs = [];
  for (let i = 0; i < NUMBER_OF_RECORDS; i++) {
    const document = await db.collection(collection).findOneAndUpdate(
      {
        status: {
          $eq: OutboxStatus.PUBLISHED,
        },
        claimedBy: {
          $eq: null,
        },
        completionAttempts: {
          $lt: MAX_RETRIES,
        },
        segregationRef,
      },
      {
        $set: {
          status: OutboxStatus.PROCESSING,
          claimedBy,
          claimedAt: new Date(),
          claimExpiresAt: new Date(Date.now() + EXPIRES_IN_MS),
        },
      },
      { sort: { publicationDate: 1 }, returnDocument: "after" },
    );
    docs.push(document);
  }
  const documents = docs.filter((d) => d !== null);

  documents?.length &&
    logger.info(`Found "${documents.length}" outbox documents to process.`);

  return documents.map((doc) => Outbox.fromDocument(doc));
};

export const update = async (event, claimedBy) => {
  const document = event.toDocument();
  const { _id, ...updateDoc } = document;

  return db
    .collection(collection)
    .updateOne({ _id, claimedBy }, { $set: updateDoc });
};

export const insertMany = async (events, session) => {
  return db.collection(collection).insertMany(
    events.map((event) => event.toDocument()),
    { session },
  );
};

export const updateExpiredEvents = async () => {
  const results = await db.collection(collection).updateMany(
    {
      claimExpiresAt: { $lt: new Date() },
      // PARKED is excluded as well as the two terminal statuses: an
      // operator parked this row on purpose and no sweep may move it.
      status: {
        $nin: [
          OutboxStatus.DEAD_LETTER,
          OutboxStatus.COMPLETED,
          OutboxStatus.PARKED,
        ],
      },
    },
    {
      $set: {
        status: OutboxStatus.FAILED,
        // Nothing threw here - the claim simply outlived its holder - so the
        // sweep records itself as the reason.
        lastError: claimExpiredError(),
        claimedAt: null,
        claimExpiresAt: null,
        claimedBy: null,
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
  return results;
};

export const updateFailedEvents = async () => {
  const results = await db.collection(collection).updateMany(
    {
      // Selects FAILED alone, so PARKED is out of scope by construction.
      status: OutboxStatus.FAILED,
    },
    {
      $set: {
        status: OutboxStatus.RESUBMITTED,
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
      status: OutboxStatus.RESUBMITTED,
    },
    {
      $set: {
        status: OutboxStatus.PUBLISHED,
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

export const updateDeadEvents = async () => {
  const results = await db.collection(collection).updateMany(
    {
      completionAttempts: { $gte: MAX_RETRIES },
      // `$nin`, not `$ne`: `$ne: DEAD_LETTER` matched PARKED rows too and
      // would have dragged poison an operator parked straight back into
      // DEAD_LETTER on the next tick.
      status: { $nin: [OutboxStatus.DEAD_LETTER, OutboxStatus.PARKED] },
    },
    {
      $set: {
        status: OutboxStatus.DEAD_LETTER,
        claimedAt: null,
        claimExpiresAt: null,
        claimedBy: null,
      },
    },
  );
  return results;
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

const eventIdOf = (doc) => orNull(doc.event?.id);

const eventTypeOf = (doc) => orNull(doc.event?.type);

// audit payloads carry no traceparent (their `correlationid` is a different
// identifier and is deliberately not used here), so those rows stay null.
const traceparentOf = (doc) => orNull(doc.event?.traceparent);

// Rebuilt from its three contract keys, exactly as `lastError` is: a `parked`
// object written by another version must not leak an extra key past the
// response schema.
const toParked = (value) =>
  value
    ? {
        at: toIsoOrNull(value.at),
        reason: String(value.reason ?? ""),
        by: orNull(value.by),
      }
    : null;

// Same rebuild for the redrive record.
const toLastRedrive = (value) =>
  value ? { at: toIsoOrNull(value.at), by: orNull(value.by) } : null;

// The list projection, and the exact shape a redrive returns. Extracted from
// `findPage`'s `mapDocument` so a redriven row is byte-identical to the same
// row on the list page.
export const toListRow = (doc) => ({
  _id: doc._id.toHexString(),
  eventId: eventIdOf(doc),
  type: eventTypeOf(doc),
  target: orNull(doc.target),
  segregationRef: orNull(doc.segregationRef),
  status: doc.status,
  completionAttempts: orNull(doc.completionAttempts),
  traceparent: traceparentOf(doc),
  createdAt: toIsoOrNull(doc.publicationDate),
  lastFailureAt: toIsoOrNull(doc.lastResubmissionDate),
  lastError: toLastError(doc.lastError),
  completedAt: toIsoOrNull(doc.completionDate),
  // `{ at, reason, by }` while the row is PARKED, null otherwise.
  parked: toParked(doc.parked),
  // `{ at, by }` for the most recent redrive of this row, null until redriven.
  lastRedrive: toLastRedrive(doc.lastRedrive),
});

const outboxCursorCodecs = {
  publicationDate: {
    encode: (v) => v.toISOString(),
    decode: (v) => new Date(v),
  },
  _id: {
    encode: (v) => v.toHexString(),
    decode: (v) => new ObjectId(v),
  },
};

// `publicationDate` is the box's sort key AND its time-range field, and it is
// a BSON Date on every outbox document, so an ISO bound is coerced to a Date -
// a string bound would silently match nothing.
const listFilter = ({ status, q, error, from, to }) =>
  buildEventListFilter({
    status,
    q,
    error,
    from,
    to,
    eventIdField: "event.id",
    traceparentField: "event.traceparent",
    rangeField: "publicationDate",
    rangeIsDate: true,
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
    sort: { publicationDate: -1, _id: -1 },
    pageSize,
    withTotal: false,
    codecs: outboxCursorCodecs,
    project: {
      _id: 1,
      "event.id": 1,
      "event.type": 1,
      // the ONLY other `event` key ever projected - the W3C traceparent that
      // links this row to its logs. Never `event.data` or the payload itself.
      "event.traceparent": 1,
      target: 1,
      segregationRef: 1,
      status: 1,
      completionAttempts: 1,
      publicationDate: 1,
      lastResubmissionDate: 1,
      completionDate: 1,
      lastError: 1,
      parked: 1,
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
      redriveUpdate(OutboxStatus.RESUBMITTED, { by }),
      { returnDocument: "after" },
    );

  return doc ? toListRow(doc) : null;
};

// Park and unpark, the same single conditional update the redrive is: the
// expected status IS the precondition, so a concurrent change matches nothing
// and the use case reports a 409 rather than clobbering it.
//
// PARKED is terminal for the pollers - see the PARKED exclusions in the claim,
// claim-expiry and dead-letter filters above, and the tests that run those
// real filters against a parked document.
export const parkById = async (id, { reason, by } = {}) => {
  const doc = await db
    .collection(collection)
    .findOneAndUpdate(
      { _id: toId(id), status: PARK_FROM_STATUS },
      parkUpdate({ reason, by }),
      { returnDocument: "after" },
    );

  return doc ? toListRow(doc) : null;
};

export const unparkById = async (id) => {
  const doc = await db
    .collection(collection)
    .findOneAndUpdate(
      { _id: toId(id), status: UNPARK_FROM_STATUS },
      unparkUpdate(),
      { returnDocument: "after" },
    );

  return doc ? toListRow(doc) : null;
};

// How the dead letters in this box group by (failure message, event type).
// Scoped to DEAD_LETTER here rather than by the caller so the breakdown can
// never accidentally count a PARKED or a still-retrying row.
export const breakdown = async (filter = {}) =>
  toBreakdownGroups(
    await db
      .collection(collection)
      .aggregate(
        breakdownStages({
          filter: listFilter({ ...filter, status: REDRIVE_FROM_STATUS }),
          typeField: BREAKDOWN_TYPE_FIELDS.outbox,
          sortKey: "publicationDate",
        }),
      )
      .toArray(),
  );
