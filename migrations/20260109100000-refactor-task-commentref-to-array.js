export const up = async (db) => {
  const cases = await db.collection("cases").find({}).toArray();

  for (const kase of cases) {
    let updated = false;

    for (const phase of kase.phases || []) {
      for (const stage of phase.stages || []) {
        for (const taskGroup of stage.taskGroups || []) {
          for (const task of taskGroup.tasks || []) {
            // Convert single commentRef to commentRefs array
            if (task.commentRef !== undefined) {
              if (task.commentRef) {
                // If there's an existing commentRef, convert to array with status
                task.commentRefs = [
                  {
                    status: task.status,
                    ref: task.commentRef,
                  },
                ];
              } else {
                // If null/empty, set to empty array
                task.commentRefs = [];
              }
              delete task.commentRef;
              updated = true;
            }
          }
        }
      }
    }

    if (updated) {
      await db
        .collection("cases")
        .updateOne({ _id: kase._id }, { $set: { phases: kase.phases } });
    }
  }
};
