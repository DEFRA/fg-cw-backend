export const up = async (db) => {
  await db
    .collection("workflows")
    .updateMany({ "stages.actions.id": { $exists: true } }, [
      {
        $set: {
          stages: {
            $map: {
              input: "$stages",
              as: "stage",
              in: {
                code: "$$stage.code",
                name: "$$stage.name",
                taskGroups: "$$stage.taskGroups",
                actionsTitle: "$$stage.actionsTitle",
                actions: {
                  $map: {
                    input: "$$stage.actions",
                    as: "action",
                    in: {
                      code: "$$action.id",
                      label: "$$action.label",
                      comment: "$$action.comment",
                    },
                  },
                },
                agreements: "$$stage.agreements",
              },
            },
          },
        },
      },
      { $unset: "stages.actions.id" },
    ]);
};

export const down = async (db) => {
  await db
    .collection("workflows")
    .updateMany({ "stages.actions.code": { $exists: true } }, [
      {
        $set: {
          stages: {
            $map: {
              input: "$stages",
              as: "stage",
              in: {
                code: "$$stage.code",
                name: "$$stage.name",
                taskGroups: "$$stage.taskGroups",
                actionsTitle: "$$stage.actionsTitle",
                actions: {
                  $map: {
                    input: "$$stage.actions",
                    as: "action",
                    in: {
                      id: "$$action.code",
                      label: "$$action.label",
                      comment: "$$action.comment",
                    },
                  },
                },
                agreements: "$$stage.agreements",
              },
            },
          },
        },
      },
      { $unset: "stages.actions.code" },
    ]);
};
