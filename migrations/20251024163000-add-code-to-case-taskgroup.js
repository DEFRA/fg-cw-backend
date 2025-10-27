export const up = async (db) => {
  const workflows = await db.collection("workflows").find({}).toArray();
  const cases = db.collection("cases").find({});

  for await (const kase of cases) {
    const { caseRef, workflowCode } = kase;
    const workflow = workflows.find((w) => w.code === workflowCode);

    for (const [i, stage] of workflow.stages.entries()) {
      for (const [j, taskGroup] of stage.taskGroups.entries()) {
        await db.collection("cases").updateOne(
          { caseRef, workflowCode },
          {
            $set: {
              [`stages.${i}.taskGroups.${j}.code`]: taskGroup.code,
            },
          },
        );
      }
    }
  }
};

export const down = async (db) => {
  await db
    .collection("cases")
    .updateMany({}, { $unset: "stages.taskGroups.code" });
};
