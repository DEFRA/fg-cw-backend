/**
 * Normalizes existing emails to lowercase and adds unique index on email field.
 * Ensures no duplicate users with same email (case-insensitive).
 */
export const up = async (db) => {
  const users = db.collection("users");

  // Normalize existing emails to lowercase in case there are production users
  await users.updateMany({ email: { $exists: true, $ne: null } }, [
    { $set: { email: { $toLower: "$email" } } },
  ]);

  const existingIndexes = await users.indexes();
  const emailIndexExists = existingIndexes.some(
    (index) => index.key && index.key.email === 1,
  );

  if (!emailIndexExists) {
    await users.createIndex({ email: 1 }, { unique: true });
  }
};
