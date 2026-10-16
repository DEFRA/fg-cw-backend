import { ObjectId } from "mongodb";
import { actuatorReadMaxTimeMs } from "../../common/actuator-read.js";
import { db } from "../../common/mongo-client.js";
import { toDetailDocument } from "../../events/event-detail.js";
import { editFence, editUpdate } from "../../events/event-edit.js";
import { purgeUpdate } from "../../events/event-purge.js";
import {
  DEAD_LETTER,
  REDRIVABLE_STATUSES,
  redriveUpdate,
} from "../../events/event-redrive.js";

const toId = (id) => ObjectId.createFromHexString(id);

export const orNull = (value) => value ?? null;

// Projected away so they never leave the database: `claimedBy` is a live claim
// token, and the claim times are poller internals.
const DETAIL_PROJECTION = { claimedBy: 0, claimedAt: 0, claimExpiresAt: 0 };

const findDetailByIdFor =
  ({ collection, box, maxRetries }) =>
  async (id) => {
    const doc = await db
      .collection(collection)
      .findOne(
        { _id: toId(id) },
        { projection: DETAIL_PROJECTION, maxTimeMS: actuatorReadMaxTimeMs() },
      );

    return doc ? toDetailDocument(doc, maxRetries, box) : null;
  };

// `session` makes this read see the same state as the redrive's failed match.
const findStatusByIdFor =
  ({ collection }) =>
  async (id, session) => {
    const doc = await db.collection(collection).findOne(
      { _id: toId(id) },
      {
        projection: { status: 1 },
        session,
        maxTimeMS: actuatorReadMaxTimeMs(),
      },
    );

    return doc ? doc.status : null;
  };

// The status filter is the precondition, so a concurrent change is a 409.
const redriveByIdFor =
  ({ collection, resubmittedStatus }) =>
  async (id, { by, session } = {}) => {
    const { matchedCount } = await db
      .collection(collection)
      .updateOne(
        { _id: toId(id), status: { $in: REDRIVABLE_STATUSES } },
        redriveUpdate(resubmittedStatus, { by }),
        { session },
      );

    return matchedCount === 1;
  };

// Fenced on DEAD_LETTER alone: the system has to have given up on a row before
// an operator can.
const purgeByIdFor =
  ({ collection }) =>
  async (id, { by, reasonCode, note, session } = {}) => {
    const { matchedCount } = await db
      .collection(collection)
      .updateOne(
        { _id: toId(id), status: DEAD_LETTER },
        purgeUpdate({ by, reasonCode, note }),
        { session },
      );

    return matchedCount === 1;
  };

// What an edit is checked against. The fenced update still decides a race.
const EDITABLE_PROJECTION = {
  status: 1,
  payloadRevision: 1,
  event: 1,
  lastEdit: 1,
};

const findEditableByIdFor =
  ({ collection }) =>
  (id, session) =>
    db.collection(collection).findOne(
      { _id: toId(id) },
      {
        projection: EDITABLE_PROJECTION,
        session,
        maxTimeMS: actuatorReadMaxTimeMs(),
      },
    );

// Fenced on the redrivable statuses and on the revision the editor started
// from, so a stale editor overwrites nothing.
const editPayloadByIdFor =
  ({ collection, editColumns = () => ({}) }) =>
  async (id, { event, by, note, revision, original, session }) => {
    const { matchedCount } = await db.collection(collection).updateOne(
      { _id: toId(id), ...editFence(revision) },
      editUpdate({
        event,
        by,
        note,
        revision,
        original,
        inboxColumns: editColumns(event),
      }),
      { session },
    );

    return matchedCount === 1;
  };

// The admin read and mutation queries both boxes share.
export const actuatorBoxQueries = (boxConfig) => ({
  findDetailById: findDetailByIdFor(boxConfig),
  findStatusById: findStatusByIdFor(boxConfig),
  redriveById: redriveByIdFor(boxConfig),
  purgeById: purgeByIdFor(boxConfig),
  findEditableById: findEditableByIdFor(boxConfig),
  editPayloadById: editPayloadByIdFor(boxConfig),
});
