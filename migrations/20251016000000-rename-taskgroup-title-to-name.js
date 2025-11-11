export const up = async (db) => {
  await db
    .collection("workflows")
    .updateMany({ "stages.taskGroups.title": { $exists: true } }, [
      {
        $set: {
          stages: {
            $map: {
              input: "$stages",
              as: "stage",
              in: {
                $mergeObjects: [
                  "$$stage",
                  {
                    taskGroups: {
                      $map: {
                        input: "$$stage.taskGroups",
                        as: "tg",
                        in: {
                          $mergeObjects: ["$$tg", { name: "$$tg.title" }],
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      { $unset: "stages.taskGroups.title" },
    ]);
};

export const down = async (db) => {
  await db
    .collection("workflows")
    .updateMany({ "stages.taskGroups.name": { $exists: true } }, [
      {
        $set: {
          stages: {
            $map: {
              input: "$stages",
              as: "stage",
              in: {
                $mergeObjects: [
                  "$$stage",
                  {
                    taskGroups: {
                      $map: {
                        input: "$$stage.taskGroups",
                        as: "tg",
                        in: {
                          $mergeObjects: ["$$tg", { title: "$$tg.name" }],
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      { $unset: "stages.taskGroups.name" },
    ]);
};
