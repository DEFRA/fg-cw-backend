/**
 * Normalizes existing emails to lowercase and adds unique index on email field.
 * Ensures no duplicate users with same email (case-insensitive).
 *
 * Update: As of 26rh Feb this migration is updated and is modified to add two check
 * first : find the record with placehoder email address and update each row to be placeholder-random-string
 * second: if the email index already exists, then skip the migration
 */

export const up = async (db) => {
  const users = db.collection("users");

  // Normalize existing emails to lowercase in case there are production users
  await users.updateMany({ email: { $exists: true, $ne: null } }, [
    { $set: { email: { $toLower: "$email" } } },
  ]);

  // find the record with placehoder email address and update each row to be placeholder-random-string
  const placeholderUsers = await users
    .find({ email: { $regex: /^placeholder/i } })
    .toArray();

  for (const user of placeholderUsers) {
    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          email: `placeholder-${(Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2)).slice(-6)}@rpa.gov.uk`,
        },
      },
    );
  }

  // only create the index if it doesn't already exist
  const existingIndexes = await users.indexes();
  const emailIndexExists = existingIndexes.some(
    (index) => index.key && index.key.email === 1,
  );

  if (!emailIndexExists) {
    await users.createIndex({ email: 1 }, { unique: true });
  }
};
