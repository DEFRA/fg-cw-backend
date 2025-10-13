export const up = async (db) => {
  await db
    .collection("cases")
    .updateMany({ "timeline.data.stageId": { $exists: true } }, [
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
                              stageCode: "$$event.data.stageId",
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
        $unset: "timeline.data.stageId",
      },
    ]);
};

export const down = async (db) => {
  await db
    .collection("cases")
    .updateMany({ "timeline.data.stageCode": { $exists: true } }, [
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
                              stageId: "$$event.data.stageCode",
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
        $unset: "timeline.data.stageCode",
      },
    ]);
};
