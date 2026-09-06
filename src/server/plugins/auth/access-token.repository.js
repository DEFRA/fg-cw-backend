import { db } from "../../../common/mongo-client.js";

const collection = "access_tokens";

export const findById = (id) => db.collection(collection).findOne({ id });

// must observe a write that just happened, so read from the primary
export const findByClient = (client) =>
  db.collection(collection).findOne({ client }, { readPreference: "primary" });

export const upsertForClient = ({ client, id }) =>
  db
    .collection(collection)
    .replaceOne({ client }, { id, client, expiresAt: null }, { upsert: true });
