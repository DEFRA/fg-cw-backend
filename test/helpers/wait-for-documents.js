/* eslint-disable complexity */
import { setTimeout } from "timers/promises";

const INTERVAL_MS = 100;

export const waitForDocuments = async (
  collection,
  maxSeconds = 10,
  filter = {},
) => {
  const maxRetries = (maxSeconds * 1000) / INTERVAL_MS;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const docs = await collection.find(filter).toArray();
    if (docs.length > 0) {
      return docs;
    }

    await setTimeout(INTERVAL_MS);
  }

  throw new Error("No documents found after maximum retries");
};
