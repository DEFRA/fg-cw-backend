import { dropIndex, ensureIndexes } from "../src/common/buckets/indexes.js";
import { inboxBucket } from "../src/cases/buckets/inbox.bucket.js";
import { outboxBucket } from "../src/cases/buckets/outbox.bucket.js";

const LIST = { publicationDate: -1, _id: -1 };

// One list index per filter shape on both boxes: none, status, type, type and
// status. The outbox no longer leads every line with the event type (it only
// did so to leave audit rows out), so its error name, error key and refs lines
// take the inbox's shapes. Add-only: the indexes the last release reads stay,
// so its instances keep working while this one rolls out.
const added = {
  outbox: [
    { status: 1, "lastError.name": 1, ...LIST },
    { status: 1, errorKey: 1, eventType: 1, ...LIST },
    { refs: 1, ...LIST },
  ],
  inbox: [
    { eventType: 1, ...LIST },
    { eventType: 1, status: 1, ...LIST },
  ],
};

export const up = async (db) => {
  await ensureIndexes(db, outboxBucket());
  await ensureIndexes(db, inboxBucket());
};

export const down = async (db) => {
  for (const [box, keys] of Object.entries(added)) {
    for (const key of keys) {
      await dropIndex(db.collection(box), key);
    }
  }
};
