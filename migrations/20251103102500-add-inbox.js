export const up = async (db) => {
  await db.createCollection("inbox");
  await db.collection("inbox").createIndex({
    status: 1,
    claimedBy: 1,
    completionAttempts: 1,
    publicationDate: 1,
  });

  await db.collection("inbox").createIndex({
    messageId: 1,
  });

  await db.collection("inbox").createIndex({
    claimExpiresAt: 1,
  });

  await db.collection("inbox").createIndex({
    status: 1,
    completionAttempts: 1,
  });
};

export const down = async (db) => {
  await db.collection("inbox").drop();
};
