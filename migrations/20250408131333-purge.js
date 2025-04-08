/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const up = async (db) => {
  await db.dropCollection("cases");
  await db.dropCollection("workflows");
  await db.createCollection("cases");
  await db.createCollection("workflows");
  await db.createIndex(
    "cases",
    {
      caseId: 1
    },
    {
      unique: true
    }
  );
  await db.createIndex(
    "workflows",
    {
      workflowId: 1
    },
    {
      unique: true
    }
  );
  await db.createIndex(
    "cases",
    {
      caseId: 1,
      workflowId: 1
    },
    {
      unique: true
    }
  );
};
