export const up = async (db) => {
  await db
    .collection("workflows")
    .updateMany({ "stages.actions.label": { $exists: true } }, [
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
                      code: "$$action.code",
                      name: "$$action.label",
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
      { $unset: "stages.actions.label" },
    ]);
};

export const down = async (db) => {
  await db
    .collection("workflows")
    .updateMany({ "stages.actions.name": { $exists: true } }, [
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
                      code: "$$action.code",
                      label: "$$action.name",
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
      { $unset: "stages.actions.name" },
    ]);
};
