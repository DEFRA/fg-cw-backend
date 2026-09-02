import { ObjectId } from "mongodb";
import { config } from "../../common/config.js";
import { db } from "../../common/mongo-client.js";
import { paginate } from "../../common/paginate.js";
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
      completionAttempts: { $lte: MAX_RETRIES },
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
        completionAttempts: { $lte: MAX_RETRIES },
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
        claimedBy: null,
        claimedAt: null,
        claimExpiresAt: null,
      },
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
      $inc: { completionAttempts: 1 },
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

export const findPage = ({ cursor, direction, pageSize, status }) =>
  paginate(db.collection(collection), {
    filter: status ? { status } : {},
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
    },
    mapDocument: (doc) => ({
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
      completedAt: toIsoOrNull(doc.completionDate),
    }),
  });
