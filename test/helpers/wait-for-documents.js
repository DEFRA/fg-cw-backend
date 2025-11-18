import { setTimeout } from "timers/promises";

// eslint-disable-next-line complexity
export const waitForDocuments = async (
  collection,
  maxRetries = 10,
  filter = {},
) => {
  const docs = await collection.find(filter).toArray();

  if (docs.length > 0) {
    return docs;
  }

  if (maxRetries <= 0) {
    throw new Error("No documents found after maximum retries");
  }

  await setTimeout(1000);

  return waitForDocuments(collection, maxRetries - 1);
};
