export const up = async (db) => {
  await db.collection("cases").createIndex({
    createdAt: 1,
    _id: 1,
    workflowCode: 1,
  });
  // await db.collection("cases").createIndex({
  // });
};
