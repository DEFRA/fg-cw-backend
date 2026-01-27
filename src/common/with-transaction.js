import { mongoClient } from "./mongo-client.js";

export const transactionOptions = {
  readPreference: "primary",
  readConcern: { level: "local" },
  writeConcern: { w: "majority" },
};

export const withTransaction = async (callback) => {
  const session = mongoClient.startSession();

  try {
    await session.withTransaction(callback, transactionOptions);
  } finally {
    await session.endSession();
  }
};
