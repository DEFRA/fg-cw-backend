import { ObjectId } from "mongodb";
import { config } from "../../common/config.js";
import {
  AUDIT_TARGET_FIELDS,
  EVENT_TYPE_FIELDS,
  auditGroupExpression,
  isAuditTarget,
  typeLabels,
} from "../../events/event-audit.js";
import {
  breakdownStages,
  toBreakdownGroups,
} from "../../events/event-breakdown.js";
import { toDetailDocument } from "../../events/event-detail.js";
import { toSourceFacets } from "../../events/event-facets.js";
import { buildEventListFilter } from "../../events/event-list-filter.js";
import {
  REDRIVE_FROM_STATUS,
  redriveUpdate,
} from "../../events/event-redrive.js";
import {
  claimExpiredAttempt,
  claimExpiredError,
  pushAttemptUpdate,
  toStoredLastError,
} from "../../events/last-error.js";
import { logger } from "../../common/logger.js";
import { db } from "../../common/mongo-client.js";
import { dateCodec, objectIdCodec, paginate } from "../../common/paginate.js";
import { statusGroupStage } from "../../events/status-counts.js";
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
      status: { $nin: [OutboxStatus.DEAD_LETTER, OutboxStatus.COMPLETED] },
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
      // A sweep never loads the model, so the ten-entry history cap must be
      // applied by Mongo (`$slice` inside pushAttemptUpdate).
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
      // No `$inc`: a state transition is not an attempt - the counter is
      // raised by `markAsFailed` (ATTEMPT ARITHMETIC, models/inbox.js).
    },
  );
  return results;
};

export const updateDeadEvents = async () => {
  const results = await db.collection(collection).updateMany(
    {
      completionAttempts: { $gte: MAX_RETRIES },
      status: { $ne: OutboxStatus.DEAD_LETTER },
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

const eventIdOf = (doc) => orNull(doc.event?.id);

const eventTypeOf = (doc) => orNull(doc.event?.type);

// The list projection, and the exact shape a redrive returns - a redriven row
// must be byte-identical to the same row on the list page.
export const toListRow = (doc) => ({
  _id: doc._id.toHexString(),
  eventId: eventIdOf(doc),
  // Never null: a type-less row is labelled "audit" or "unknown" by the same
  // predicate the list filter uses, so the label and the filter can never
  // disagree. See events/event-audit.js.
  type: typeLabels(eventTypeOf(doc), isAuditTarget(doc.target)).type,
  target: orNull(doc.target),
  status: doc.status,
  completionAttempts: orNull(doc.completionAttempts),
  createdAt: toIsoOrNull(doc.publicationDate),
  lastFailureAt: toIsoOrNull(doc.lastResubmissionDate),
  lastError: toStoredLastError(doc.lastError),
  completedAt: toIsoOrNull(doc.completionDate),
});

const outboxCursorCodecs = { publicationDate: dateCodec, _id: objectIdCodec };

// `publicationDate` is the box's sort key AND its time-range field, and it is
// a BSON Date on every outbox document, so an ISO bound is coerced to a Date -
// a string bound would silently match nothing.
const listFilter = ({ status, q, error, from, to, audit }) =>
  buildEventListFilter({
    status,
    q,
    error,
    from,
    to,
    // The list, the counts and the breakdown all come through here, so they
    // narrow together: the figures above a page always describe its rows.
    audit,
    eventIdField: "event.id",
    traceparentField: "event.traceparent",
    targetField: AUDIT_TARGET_FIELDS.outbox,
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
  audit,
}) =>
  paginate(db.collection(collection), {
    filter: listFilter({ status, q, error, from, to, audit }),
    cursor,
    direction,
    sort: { publicationDate: -1, _id: -1 },
    pageSize,
    withTotal: false,
    codecs: outboxCursorCodecs,
    // Exactly the fields `toListRow` maps, and no more: a projection that
    // fetches what nothing renders reads as an intention to return it.
    // `segregationRef` and the traceparent are still SEARCHABLE - `q` matches
    // them in the filter, which needs no projection to do it.
    project: {
      _id: 1,
      "event.id": 1,
      "event.type": 1,
      target: 1,
      status: 1,
      completionAttempts: 1,
      publicationDate: 1,
      lastResubmissionDate: 1,
      completionDate: 1,
      lastError: 1,
    },
    mapDocument: toListRow,
  });

// The status split for the whole filtered box, not one page - no cursor, so
// the figures do not move as the operator pages. `status` is deliberately not
// a parameter: grouping BY status is the point. See events/status-counts.js
// for the accepted cost of the scan.
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

  return doc ? toDetailDocument(doc, MAX_RETRIES, "outbox") : null;
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
      redriveUpdate(OutboxStatus.RESUBMITTED, { by }),
      { returnDocument: "after", session },
    );

  return doc ? toListRow(doc) : null;
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
          typeField: EVENT_TYPE_FIELDS.outbox,
          auditExpression: auditGroupExpression(AUDIT_TARGET_FIELDS.outbox),
          sortKey: "publicationDate",
        }),
      )
      .toArray(),
  );
