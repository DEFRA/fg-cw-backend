/**
 * @param db {import('mongodb').Db}
 * @returns {Promise<void>}
 */
export const up = async (db) => {
  const collectionNames = (await db.collections()).map((e) => e.collectionName);
  if (collectionNames.includes("cases")) {
    await db.dropCollection("cases");
  }
  if (collectionNames.includes("workflows")) {
    await db.dropCollection("workflows");
  }
  await db.createCollection("cases");
  await db.createCollection("workflows");
  await db.collection("cases").dropIndexes();
  await db.collection("workflows").dropIndexes();
  await db.createIndex(
    "cases",
    {
      workflowCode: 1,
      caseRef: 1
    },
    {
      unique: true
    }
  );
  await db.createIndex(
    "workflows",
    {
      workflowCode: 1
    },
    {
      unique: true
    }
  );
};
