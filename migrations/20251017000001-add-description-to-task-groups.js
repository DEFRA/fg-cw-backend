export const up = async (db) => {
  await db
    .collection("workflows")
    .updateMany({ code: { $in: ["frps-private-beta", "pigs-might-fly"] } }, [
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
                          $mergeObjects: [
                            "$$tg",
                            { description: "Task group description" },
                          ],
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
    ]);
};

export const down = async (db) => {
  await db
    .collection("workflows")
    .updateMany(
      { code: { $in: ["frps-private-beta", "pigs-might-fly"] } },
      { $unset: "stages.$[].taskGroups.$[].description" },
    );
};
