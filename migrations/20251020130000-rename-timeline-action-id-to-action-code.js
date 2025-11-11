export const up = async (db) => {
  await db
    .collection("cases")
    .updateMany({ "timeline.data.actionId": { $exists: true } }, [
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
                              actionCode: "$$event.data.actionId",
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
      { $unset: "timeline.data.actionId" },
    ]);
};

export const down = async (db) => {
  await db
    .collection("cases")
    .updateMany({ "timeline.data.actionCode": { $exists: true } }, [
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
                              actionId: "$$event.data.actionCode",
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
      { $unset: "timeline.data.actionCode" },
    ]);
};
