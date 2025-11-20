import { config } from "../../common/config.js";
import { logger } from "../../common/logger.js";
import { db } from "../../common/mongo-client.js";
import { Outbox, OutboxStatus } from "../models/outbox.js";

const collection = "outbox";

const MAX_RETRIES = parseInt(config.get("outbox.outboxMaxRetries"));
const EXPIRES_IN_MS = parseInt(config.get("outbox.outboxExpiresMs"));
const NUMBER_OF_RECORDS = parseInt(config.get("outbox.outboxClaimMaxRecords"));

export const claimEvents = async (claimedBy) => {
  logger.debug("Claiming outbox events", {
    claimedBy,
    maxRecords: NUMBER_OF_RECORDS,
  });

  const promises = [];
  for (let i = 0; i < NUMBER_OF_RECORDS; i++) {
    promises.push(
      db.collection(collection).findOneAndUpdate(
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
      ),
    );
  }
  const docs = await Promise.all(promises);
  const documents = docs.filter((d) => d !== null);

  documents?.length &&
    logger.info(`Found ${documents.length} outbox documents to process.`);

  logger.debug("Outbox events claimed", {
    claimedBy,
    claimed: documents.length,
    attempted: NUMBER_OF_RECORDS,
  });
  return documents.map((doc) => Outbox.fromDocument(doc));
};

export const update = async (event, claimedBy) => {
  logger.debug("Updating outbox event", {
    eventId: event.id,
    claimedBy,
    status: event.status,
  });

  const document = event.toDocument();
  const { _id, ...updateDoc } = document;

  const result = await db
    .collection(collection)
    .updateOne({ _id, claimedBy }, { $set: updateDoc });

  logger.debug("Outbox event updated", {
    eventId: event.id,
    modifiedCount: result.modifiedCount,
  });
  return result;
};

export const insertMany = async (events, session) => {
  logger.debug("Inserting multiple outbox events", {
    count: events.length,
    hasSession: !!session,
  });

  const result = await db.collection(collection).insertMany(
    events.map((event) => event.toDocument()),
    { session },
  );

  logger.debug("Multiple outbox events inserted", {
    insertedCount: result.insertedCount,
  });
  return result;
};

export const updateExpiredEvents = async () => {
  logger.debug("Updating expired outbox events");

  const results = await db.collection(collection).updateMany(
    {
      claimExpiresAt: { $lt: new Date() },
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

  logger.debug("Expired outbox events updated", {
    modifiedCount: results.modifiedCount,
  });
  return results;
};

export const updateFailedEvents = async () => {
  logger.debug("Updating failed outbox events to resubmitted");

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

  logger.debug("Failed outbox events updated", {
    modifiedCount: results.modifiedCount,
  });
  return results;
};

export const updateResubmittedEvents = async () => {
  logger.debug("Updating resubmitted outbox events to published");

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

  logger.debug("Resubmitted outbox events updated", {
    modifiedCount: results.modifiedCount,
  });
  return results;
};

export const updateDeadEvents = async () => {
  logger.debug("Updating dead outbox events", { maxRetries: MAX_RETRIES });

  const results = await db.collection(collection).updateMany(
    {
      completionAttempts: { $gte: MAX_RETRIES },
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

  logger.debug("Dead outbox events updated", {
    modifiedCount: results.modifiedCount,
  });
  return results;
};
