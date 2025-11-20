import { config } from "../../common/config.js";
import { logger } from "../../common/logger.js";
import { db } from "../../common/mongo-client.js";
import { Inbox, InboxStatus } from "../models/inbox.js";

const collection = "inbox";
const MAX_RETRIES = parseInt(config.get("inbox.inboxMaxRetries"));
const NUMBER_OF_RECORDS = parseInt(config.get("inbox.inboxClaimMaxRecords"));
const EXPIRES_IN_MS = parseInt(config.get("inbox.inboxExpiresMs"));

export const claimEvents = async (claimedBy) => {
  logger.debug("Claiming inbox events", {
    claimedBy,
    maxRecords: NUMBER_OF_RECORDS,
  });

  const promises = [];

  for (let i = 0; i < NUMBER_OF_RECORDS; i++) {
    promises.push(
      db.collection(collection).findOneAndUpdate(
        {
          status: { $eq: InboxStatus.PUBLISHED },
          claimedBy: { $eq: null },
          completionAttempts: { $lte: MAX_RETRIES },
        },
        {
          $set: {
            status: InboxStatus.PROCESSING,
            claimedBy,
            claimedAt: new Date(),
            claimExpiresAt: new Date(Date.now() + EXPIRES_IN_MS),
          },
        },
        { sort: { publicationDate: 1 }, returnDocument: "after" },
      ),
    );
  }

  const docs = await Promise.all(promises);
  const documents = docs.filter((d) => d !== null);

  logger.debug("Events claimed", {
    claimedBy,
    claimed: documents.length,
    attempted: NUMBER_OF_RECORDS,
  });
  return documents.map((doc) => Inbox.fromDocument(doc));
};

export const processExpiredEvents = async () => {
  logger.debug("Processing expired inbox events");

  const result = await db.collection(collection).updateMany(
    {
      claimExpiresAt: { $lt: new Date() },
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

  logger.debug("Expired events processed", {
    modifiedCount: result.modifiedCount,
  });
};

export const updateDeadEvents = async () => {
  logger.debug("Updating dead inbox events", { maxRetries: MAX_RETRIES });

  const results = await db.collection(collection).updateMany(
    { completionAttempts: { $gte: MAX_RETRIES } },
    {
      $set: {
        status: InboxStatus.DEAD,
        claimedAt: null,
        claimExpiresAt: null,
        claimedBy: null,
      },
    },
  );

  logger.debug("Dead events updated", { modifiedCount: results.modifiedCount });
  return results;
};

// Move failed events to resubmitted status
export const updateFailedEvents = async () => {
  logger.debug("Updating failed inbox events to resubmitted");

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

  logger.debug("Failed events updated", {
    modifiedCount: results.modifiedCount,
  });
  return results;
};

// Move resubmitted events to published status
export const updateResubmittedEvents = async () => {
  logger.debug("Updating resubmitted inbox events to published");

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

  logger.debug("Resubmitted events updated", {
    modifiedCount: results.modifiedCount,
  });
  return results;
};

export const insertMany = async (events, session) => {
  logger.debug("Inserting multiple inbox events", {
    count: events.length,
    hasSession: !!session,
  });

  const result = await db.collection(collection).insertMany(
    events.map((event) => event.toDocument()),
    { session },
  );

  logger.debug("Multiple events inserted", {
    insertedCount: result.insertedCount,
  });
  return result;
};

export const findByMessageId = async (messageId) => {
  logger.debug("Finding inbox event by messageId", { messageId });

  const doc = await db.collection(collection).findOne({ messageId });

  logger.debug("Inbox event search result", { messageId, found: !!doc });
  return doc;
};

export const insertOne = async (inbox, session) => {
  logger.debug("Inserting single inbox event", {
    messageId: inbox.messageId,
    hasSession: !!session,
  });

  const result = await db
    .collection(collection)
    .insertOne(inbox.toDocument(), { session });

  logger.debug("Single event inserted", { insertedId: result.insertedId });
  return result;
};

export const update = async (inbox) => {
  logger.debug("Updating inbox event", {
    messageId: inbox.messageId,
    status: inbox.status,
  });

  const document = inbox.toDocument();
  const { _id, ...updateDoc } = document;

  const result = await db
    .collection(collection)
    .updateOne({ _id }, { $set: updateDoc });

  logger.debug("Inbox event updated", {
    messageId: inbox.messageId,
    modifiedCount: result.modifiedCount,
  });
  return result;
};
