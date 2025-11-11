export const up = async (db) => {
  await db
    .collection("cases")
    .updateMany({ "stages.taskGroups.tasks.id": { $exists: true } }, [
      {
        $set: {
          stages: {
            $map: {
              input: "$stages",
              as: "stage",
              in: {
                code: "$$stage.code",
                taskGroups: {
                  $map: {
                    input: "$$stage.taskGroups",
                    as: "tg",
                    in: {
                      code: "$$tg.code",
                      tasks: {
                        $map: {
                          input: "$$tg.tasks",
                          as: "t",
                          in: {
                            code: "$$t.id",
                            status: "$$t.status",
                            updatedAt: "$$t.updatedAt",
                            updatedBy: "$$t.updatedBy",
                            commentRef: "$$t.commentRef",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      { $unset: "stages.taskGroups.tasks.id" },
    ]);
};

export const down = async (db) => {
  await db
    .collection("cases")
    .updateMany({ "stages.taskGroups.tasks.code": { $exists: true } }, [
      {
        $set: {
          stages: {
            $map: {
              input: "$stages",
              as: "stage",
              in: {
                code: "$$stage.code",
                taskGroups: {
                  $map: {
                    input: "$$stage.taskGroups",
                    as: "tg",
                    in: {
                      code: "$$tg.code",
                      tasks: {
                        $map: {
                          input: "$$tg.tasks",
                          as: "t",
                          in: {
                            id: "$$t.code",
                            status: "$$t.status",
                            updatedAt: "$$t.updatedAt",
                            updatedBy: "$$t.updatedBy",
                            commentRef: "$$t.commentRef",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      { $unset: "stages.taskGroups.tasks.code" },
    ]);
};
