export const up = async (db) => {
  await db
    .collection("case_groups")
    .createIndex({ caseType: 1, pageKey: 1, keyHash: 1 }, { unique: true });
  await db
    .collection("cases")
    .createIndex({ workflowCode: 1, currentPhase: 1, currentStage: 1 });
};
