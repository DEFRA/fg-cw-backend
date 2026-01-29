export const up = async (db) => {
  await db.collection("roles").updateMany({}, { $set: { assignable: true } });
};
