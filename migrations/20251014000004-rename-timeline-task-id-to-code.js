export const up = async (db) => {
  await db
    .collection("cases")
    .updateMany({ "timeline.data.taskId": { $exists: true } }, [
      {
        $set: {
          timeline: {
            $map: {
              input: "$timeline",
              as: "event",
              in: {
                $mergeObjects: [
                  "$$event",
                  {
                    data: {
                      $cond: {
                        if: { $ne: ["$$event.data", null] },
                        then: {
                          $mergeObjects: [
                            "$$event.data",
                            {
                              taskCode: "$$event.data.taskId",
                            },
                          ],
                        },
                        else: "$$event.data",
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      { $unset: "timeline.data.taskId" },
    ]);
};

export const down = async (db) => {
  await db
    .collection("cases")
    .updateMany({ "timeline.data.taskCode": { $exists: true } }, [
      {
        $set: {
          timeline: {
            $map: {
              input: "$timeline",
              as: "event",
              in: {
                $mergeObjects: [
                  "$$event",
                  {
                    data: {
                      $cond: {
                        if: { $ne: ["$$event.data", null] },
                        then: {
                          $mergeObjects: [
                            "$$event.data",
                            {
                              taskId: "$$event.data.taskCode",
                            },
                          ],
                        },
                        else: "$$event.data",
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      { $unset: "timeline.data.taskCode" },
    ]);
};
