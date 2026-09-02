import { ObjectId } from "mongodb";
import { config } from "../../common/config.js";
import { logger } from "../../common/logger.js";
import { db } from "../../common/mongo-client.js";
import { paginate } from "../../common/paginate.js";
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
      completionAttempts: { $lte: MAX_RETRIES },
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
          $lte: MAX_RETRIES,
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
      status: { $nin: [OutboxStatus.COMPLETED, OutboxStatus.DEAD_LETTER] },
    },
    {
      $set: {
        status: OutboxStatus.FAILED,
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
      $inc: { completionAttempts: 1 },
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

// audit entity objects also carry `entityid` - an application/agreement/user
// reference. Rebuild each entity from the two keys the contract allows rather
// than passing the projected object through.
const toAuditEntities = (entities) =>
  entities ? entities.map(({ entity, action }) => ({ entity, action })) : null;

const auditEntitiesOf = (doc) => toAuditEntities(doc.event?.audit?.entities);

const eventIdOf = (doc) => orNull(doc.event?.id);

const eventTypeOf = (doc) => orNull(doc.event?.type);

// audit payloads carry no traceparent (their `correlationid` is a different
// identifier and is deliberately not used here), so those rows stay null.
const traceparentOf = (doc) => orNull(doc.event?.traceparent);

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

export const findPage = ({ cursor, direction, pageSize, status }) =>
  paginate(db.collection(collection), {
    filter: status ? { status } : {},
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
      "event.audit.entities": 1,
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
    },
    mapDocument: (doc) => ({
      _id: doc._id.toHexString(),
      eventId: eventIdOf(doc),
      type: eventTypeOf(doc),
      auditEntities: auditEntitiesOf(doc),
      target: orNull(doc.target),
      segregationRef: orNull(doc.segregationRef),
      status: doc.status,
      completionAttempts: orNull(doc.completionAttempts),
      traceparent: traceparentOf(doc),
      createdAt: toIsoOrNull(doc.publicationDate),
      lastFailureAt: toIsoOrNull(doc.lastResubmissionDate),
      completedAt: toIsoOrNull(doc.completionDate),
    }),
  });
