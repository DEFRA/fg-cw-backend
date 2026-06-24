export const up = async (db) => {
  const workflows = db.collection("workflows");
  await workflows.createIndex({ code: 1, version: 1 }, { unique: true });
  await workflows.dropIndex("code_1");
};
