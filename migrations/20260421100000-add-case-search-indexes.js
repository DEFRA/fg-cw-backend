export const up = async (db) => {
  const cases = db.collection("cases");

  await cases.createIndex({ caseRef: 1 });
  await cases.createIndex({ "payload.identifiers.sbi": 1 });
};
