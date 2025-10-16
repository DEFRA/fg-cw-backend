export const up = async (db) => {
  await db
    .collection("workflows")
    .updateMany({ "stages.taskGroups.tasks.title": { $exists: true } }, [
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
                            {
                              tasks: {
                                $map: {
                                  input: "$$tg.tasks",
                                  as: "task",
                                  in: {
                                    $mergeObjects: [
                                      "$$task",
                                      { name: "$$task.title" },
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
                ],
              },
            },
          },
        },
      },
      { $unset: "stages.taskGroups.tasks.title" },
    ]);
};

export const down = async (db) => {
  await db
    .collection("workflows")
    .updateMany({ "stages.taskGroups.tasks.name": { $exists: true } }, [
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
                            {
                              tasks: {
                                $map: {
                                  input: "$$tg.tasks",
                                  as: "task",
                                  in: {
                                    $mergeObjects: [
                                      "$$task",
                                      { title: "$$task.name" },
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
                ],
              },
            },
          },
        },
      },
      { $unset: "stages.taskGroups.tasks.name" },
    ]);
};
