export const up = async (db) => {
  await db.collection("cases").createIndex({
    assignedUserId: 1,
    createdAt: -1,
    _id: -1,
  });
};
