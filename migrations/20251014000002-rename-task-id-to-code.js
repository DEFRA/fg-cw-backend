export const up = async (db) => {
  await db
    .collection("workflows")
    .updateMany({ "stages.taskGroups.tasks.id": { $exists: true } }, [
      {
        $set: {
          stages: {
            $map: {
              input: "$stages",
              as: "stage",
              in: {
                code: "$$stage.code",
                name: "$$stage.name",
                taskGroups: {
                  $map: {
                    input: "$$stage.taskGroups",
                    as: "tg",
                    in: {
                      code: "$$tg.code",
                      title: "$$tg.title",
                      tasks: {
                        $map: {
                          input: "$$tg.tasks",
                          as: "t",
                          in: {
                            code: "$$t.id",
                            title: "$$t.title",
                            type: "$$t.type",
                            comment: "$$t.comment",
                          },
                        },
                      },
                    },
                  },
                },
                actionsTitle: "$$stage.actionsTitle",
                actions: "$$stage.actions",
                agreements: "$$stage.agreements",
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
    .collection("workflows")
    .updateMany({ "stages.taskGroups.tasks.code": { $exists: true } }, [
      {
        $set: {
          stages: {
            $map: {
              input: "$stages",
              as: "stage",
              in: {
                code: "$$stage.code",
                name: "$$stage.name",
                taskGroups: {
                  $map: {
                    input: "$$stage.taskGroups",
                    as: "tg",
                    in: {
                      code: "$$tg.code",
                      title: "$$tg.title",
                      tasks: {
                        $map: {
                          input: "$$tg.tasks",
                          as: "t",
                          in: {
                            id: "$$t.code",
                            title: "$$t.title",
                            type: "$$t.type",
                            comment: "$$t.comment",
                          },
                        },
                      },
                    },
                  },
                },
                actionsTitle: "$$stage.actionsTitle",
                actions: "$$stage.actions",
                agreements: "$$stage.agreements",
              },
            },
          },
        },
      },
      { $unset: "stages.taskGroups.tasks.code" },
    ]);
};
