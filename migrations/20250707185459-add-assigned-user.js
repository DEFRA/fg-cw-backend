export const up = async (db) => {
  await db.collection("cases").updateMany({}, { $set: { assignedUser: null } });
};

export const down = async (db) => {
  await db.collection("cases").updateMany({}, { $unset: { assignedUser: "" } });
};
