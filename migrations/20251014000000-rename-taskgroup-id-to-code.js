export const up = async (db) => {
  await db.collection("workflows").updateMany({}, [
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
                    code: "$$tg.id",
                    title: "$$tg.title",
                    tasks: "$$tg.tasks",
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
  ]);
};

export const down = async (db) => {
  await db.collection("workflows").updateMany({}, [
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
                    id: "$$tg.code",
                    title: "$$tg.title",
                    tasks: "$$tg.tasks",
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
  ]);
};
