export const up = async (db) => {
  const cases = db.collection("cases");

  await cases.createIndex({
    workflowCode: 1,
    createdAt: -1,
    _id: -1,
  });

  await cases.createIndex({
    workflowCode: 1,
    caseRef: 1,
    createdAt: -1,
    _id: -1,
  });

  await cases.createIndex({
    workflowCode: 1,
    caseRef: -1,
    createdAt: -1,
    _id: -1,
  });
};
