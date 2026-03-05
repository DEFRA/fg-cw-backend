import { withTransaction } from "../src/common/with-transaction.js";

export const up = async (db) => {
  const caseSeries = db.collection("case_series");
  await caseSeries.createIndex({ caseRefs: 1 });
  await caseSeries.createIndex({ latestCaseRef: 1, code: 1 });
  await caseSeries.createIndex({ latestCaseId: 1 });

  await withTransaction(async (session) => {
    const date = new Date(Date.now()).toISOString();
    const cases = await db
      .collection("cases")
      .find({}, { projection: { caseRef: 1, workflowCode: 1 } })
      .toArray();

    if (!cases.length) {
      return;
    }

    await caseSeries.insertMany(
      cases.map((kase) => ({
        caseRefs: [kase.caseRef],
        latestCaseRef: kase.caseRef,
        latestCaseId: kase._id.toString(),
        workflowCode: kase.workflowCode,
        createdAt: date,
        updatedAt: date,
      })),
      { session },
    );
  });
};
