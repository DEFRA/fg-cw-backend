/**
 * Migration: Add unique index on email field
 *
 * This migration adds a unique constraint on the email field in the users collection.
 * Since emails are now normalized to lowercase before storage, this ensures:
 * 1. No duplicate users can be created with the same email address
 * 2. Database-level enforcement of email uniqueness (not just application-level)
 *
 * Prerequisites:
 * - All existing emails should already be lowercase (no production data yet)
 * - If running against existing data, ensure no duplicate emails exist first
 */
export const up = async (db) => {
  const users = db.collection("users");
  await users.createIndex({ email: 1 }, { unique: true });
};
