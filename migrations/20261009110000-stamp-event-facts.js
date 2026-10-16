import { caseStatusUpdated } from "../src/cases/events/case-status-updated.event.js";
import {
  caseCreate,
  caseUpdateStatus,
  configVersionUpdated,
} from "../src/cases/events/inbound-event-types.js";
import { toErrorKey } from "../src/common/buckets/error-key.js";
import { logger } from "../src/common/logger.js";
import { eventStatusValues } from "../src/events/event-status-values.js";
import {
  backfillInboxStamps,
  backfillOutboxStamps,
} from "../src/events/stamps.js";

// Stamps every inbox and outbox row written before the writers stamped at
// insert. Named here so the declared types are complete however this is run.
const declared = [
  caseCreate,
  caseStatusUpdated,
  caseUpdateStatus,
  configVersionUpdated,
];

const BATCH_SIZE = 1000;

const primary = { readPreference: "primary" };

const projection = {
  target: 1,
  segregationRef: 1,
  messageId: 1,
  traceparent: 1,
  event: 1,
  originalPayload: 1,
  lastError: 1,
};

// A row with a recorded error is stamped with its key as well.
const unstamped = {
  $or: [
    { eventType: null },
    { refs: null },
    { lastError: { $ne: null }, errorKey: null },
  ],
};

// The rows there were when this started. The version it replaces may still be
// writing while both run, and those rows are not this migration's to check.
const newestId = async (collection) => {
  const [newest] = await collection
    .find({}, { ...primary, projection: { _id: 1 }, sort: { _id: -1 } })
    .limit(1)
    .toArray();

  return newest?._id ?? null;
};

const upTo = (newest) => ({ _id: newest === null ? null : { $lte: newest } });

const errorKeyOf = ({ lastError }) =>
  lastError ? { errorKey: toErrorKey(lastError) } : {};

// Guarded by `unstamped`, so a row its writer stamped meanwhile is left alone.
const toWrite = (stampsOf) => (doc) => {
  const { refs, ...stamps } = stampsOf(doc);

  return {
    updateOne: {
      filter: { _id: doc._id, ...unstamped },
      update: {
        $set: { ...stamps, ...errorKeyOf(doc) },
        $addToSet: { refs: { $each: refs } },
      },
    },
  };
};

const stamp = async (collection, stampsOf, newest) => {
  const rows = collection.find(
    { ...unstamped, ...upTo(newest) },
    {
      ...primary,
      projection,
      sort: { _id: 1 },
      batchSize: BATCH_SIZE,
    },
  );
  let stamped = 0;
  let writes = [];

  for await (const doc of rows) {
    writes.push(toWrite(stampsOf)(doc));

    if (writes.length === BATCH_SIZE) {
      await collection.bulkWrite(writes, { ordered: false });
      stamped += writes.length;
      writes = [];
    }
  }

  if (writes.length > 0) {
    await collection.bulkWrite(writes, { ordered: false });
  }

  return stamped + writes.length;
};

const assertNone = async (collection, filter, problem) => {
  const count = await collection.countDocuments(filter, primary);

  if (count > 0) {
    throw new Error(`${count} ${collection.collectionName} rows ${problem}`);
  }
};

const outside = (values) => ({ $nin: [...values, null] });

const statuses = eventStatusValues.map(({ value }) => value);

const assertStamped = async (collection, newest) => {
  await assertNone(
    collection,
    { ...unstamped, ...upTo(newest) },
    "were left unstamped",
  );
  await assertNone(
    collection,
    { status: outside(statuses), ...upTo(newest) },
    "hold a status outside the listed values",
  );
};

export const up = async (db) => {
  const outbox = db.collection("outbox");
  const inbox = db.collection("inbox");

  logger.info(
    `Stamping event facts for ${declared.length} declared event types`,
  );

  const newestOutbox = await newestId(outbox);
  const newestInbox = await newestId(inbox);
  const outboxRows = await stamp(outbox, backfillOutboxStamps, newestOutbox);
  const inboxRows = await stamp(inbox, backfillInboxStamps, newestInbox);

  logger.info(`Stamped ${outboxRows} outbox rows and ${inboxRows} inbox rows`);

  await assertStamped(outbox, newestOutbox);
  await assertStamped(inbox, newestInbox);
};
