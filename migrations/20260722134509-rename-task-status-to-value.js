import { withTransaction } from "../src/common/with-transaction.js";

export const up = async (db) => {
  await withTransaction(async (session) => {
    const cases = await db.collection("cases").find({}).toArray();

    for (const kase of cases) {
      let updated = false;

      for (const phase of kase.phases || []) {
        for (const stage of phase.stages || []) {
          for (const taskGroup of stage.taskGroups || []) {
            for (const task of taskGroup.tasks || []) {
              if (task.status !== undefined) {
                task.value = task.status;
                delete task.status;
                updated = true;
              }
            }
          }
        }
      }

      if (updated) {
        await db
          .collection("cases")
          .updateOne(
            { _id: kase._id },
            { $set: { phases: kase.phases } },
            { session },
          );
      }
    }
  });
};
