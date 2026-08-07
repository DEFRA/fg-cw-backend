import { withTransaction } from "../src/common/with-transaction.js";

export const up = async (db) => {
  const collection = "cases";

  const eventType = "TASK_COMPLETED";
  const description = "SitiAgri FC Reference";

  const phaseCode = "PHASE_PRE_AWARD";
  const stageCode = "STAGE_AGREEMENT_ACCEPTED";
  const taskGroupCode = "TASK_GROUP_CRM_RECORD";
  const taskCode = "TASK_SITI_REFERENCE";

  const isBackfilledEntry = (entry) =>
    entry.eventType === eventType &&
    entry.description === description &&
    !entry.data?.taskCode;

  await withTransaction(async (session) => {
    const cases = await db
      .collection(collection)
      .find(
        {
          workflowCode: "woodland",
          timeline: {
            $elemMatch: {
              eventType,
              description,
              "data.taskCode": { $exists: false },
            },
          },
        },
        { session },
      )
      .toArray();

    for (const kase of cases) {
      const timeline = kase.timeline.map((entry) =>
        isBackfilledEntry(entry)
          ? {
              ...entry,
              data: {
                // String, not the raw ObjectId: Case.setTaskValue writes
                // this._id, which is the string form.
                caseId: kase._id.toString(),
                phaseCode,
                stageCode,
                taskGroupCode,
                taskCode,
              },
            }
          : entry,
      );

      await db
        .collection(collection)
        .updateOne({ _id: kase._id }, { $set: { timeline } }, { session });
    }
  });
};
