import { setTimeout } from "timers/promises";

export const waitForDocuments = async (collection, maxRetries = 3) => {
  const docs = await collection.find({}).toArray();

  if (docs.length > 0) {
    return docs;
  }

  if (maxRetries <= 0) {
    throw new Error("No documents found after maximum retries");
  }

  await setTimeout(1000);

  return waitForDocuments(collection, maxRetries - 1);
};
