export const up = async (db) => {
  await db
    .collection("cases")
    .updateMany({ "timeline.data.taskGroupId": { $exists: true } }, [
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
                              taskGroupCode: "$$event.data.taskGroupId",
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
      {
        $unset: "timeline.data.taskGroupId",
      },
    ]);
};

export const down = async (db) => {
  await db
    .collection("cases")
    .updateMany({ "timeline.data.taskGroupCode": { $exists: true } }, [
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
                              taskGroupId: "$$event.data.taskGroupCode",
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
      {
        $unset: "timeline.data.taskGroupCode",
      },
    ]);
};
