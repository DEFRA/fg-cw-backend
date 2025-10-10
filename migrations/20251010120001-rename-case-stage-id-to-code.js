export const up = async (db) => {
  await db.collection("cases").updateMany({}, [
    {
      $set: {
        stages: {
          $map: {
            input: "$stages",
            as: "stage",
            in: {
              code: "$$stage.id",
              taskGroups: "$$stage.taskGroups",
              outcome: "$$stage.outcome",
            },
          },
        },
      },
    },
  ]);
};

export const down = async (db) => {
  await db.collection("cases").updateMany({}, [
    {
      $set: {
        stages: {
          $map: {
            input: "$stages",
            as: "stage",
            in: {
              id: "$$stage.code",
              taskGroups: "$$stage.taskGroups",
              outcome: "$$stage.outcome",
            },
          },
        },
      },
    },
  ]);
};
