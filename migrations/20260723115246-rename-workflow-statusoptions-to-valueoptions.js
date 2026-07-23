import { withTransaction } from "../src/common/with-transaction.js";

export const up = async (db) => {
  await withTransaction(async (session) => {
    const workflows = await db.collection("workflows").find({}).toArray();

    for (const workflow of workflows) {
      let updated = false;

      for (const phase of workflow.phases || []) {
        for (const stage of phase.stages || []) {
          for (const taskGroup of stage.taskGroups || []) {
            for (const task of taskGroup.tasks || []) {
              if (task.statusOptions !== undefined) {
                task.valueOptions = task.statusOptions;
                delete task.statusOptions;
                updated = true;
              }
            }
          }
        }
      }

      if (updated) {
        await db
          .collection("workflows")
          .updateOne(
            { _id: workflow._id },
            { $set: { phases: workflow.phases } },
            { session },
          );
      }
    }
  });
};
