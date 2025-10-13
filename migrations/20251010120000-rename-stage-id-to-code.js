export const up = async (db) => {
  await db.collection("workflows").updateMany({}, [
    {
      $set: {
        stages: {
          $map: {
            input: "$stages",
            as: "stage",
            in: {
              code: "$$stage.id",
              title: "$$stage.title",
              taskGroups: "$$stage.taskGroups",
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
              id: "$$stage.code",
              title: "$$stage.title",
              taskGroups: "$$stage.taskGroups",
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
