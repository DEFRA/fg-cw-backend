import { setTimeout } from "timers/promises";

// eslint-disable-next-line complexity
export const waitForDocuments = async (
  collection,
  maxRetries = 10,
  filter = {},
  initialMaxRetries = maxRetries,
) => {
  const docs = await collection.find(filter).toArray();

  if (docs.length > 0) {
    const attempt = initialMaxRetries - maxRetries + 1;
    const timestamp = new Date().toISOString();
    // eslint-disable-next-line no-console
    console.log(
      `[TEST ${timestamp}] Documents found in ${collection.collectionName}: count=${docs.length}, attempt=${attempt}/${initialMaxRetries}`,
    );
    return docs;
  }

  if (maxRetries <= 0) {
    const timestamp = new Date().toISOString();
    // eslint-disable-next-line no-console
    console.log(
      `[TEST ${timestamp}] No documents found after ${initialMaxRetries} retries in ${collection.collectionName}, filter=${JSON.stringify(filter)}`,
    );
    throw new Error("No documents found after maximum retries");
  }

  const attempt = initialMaxRetries - maxRetries + 1;
  if (attempt === 1 || attempt % 3 === 0) {
    const timestamp = new Date().toISOString();
    // eslint-disable-next-line no-console
    console.log(
      `[TEST ${timestamp}] Waiting for documents in ${collection.collectionName}: attempt=${attempt}/${initialMaxRetries}, filter=${JSON.stringify(filter)}`,
    );
  }

  await setTimeout(1000);

  return waitForDocuments(
    collection,
    maxRetries - 1,
    filter,
    initialMaxRetries,
  );
};
