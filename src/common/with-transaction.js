import { mongoClient } from "./mongo-client.js";

export const transactionOptions = {
  readPreference: "primary",
  readConcern: { level: "local" },
  writeConcern: { w: "majority" },
};

// Answers with whatever the callback answered: a use case that has something
// to return - a redrive answers with the updated row - cannot lose it just
// because it runs in a transaction. `session.withTransaction` discards the
// callback's value, so it is captured here.
export const withTransaction = async (callback) => {
  const session = mongoClient.startSession();
  let result;

  try {
    await session.withTransaction(async (activeSession) => {
      result = await callback(activeSession);
    }, transactionOptions);
  } finally {
    await session.endSession();
  }

  return result;
};
