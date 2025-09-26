export const up = async (db) => {
  db.collection("workflows").updateMany(
    { code: { $in: ["pigs-might-fly", "frps-private-beta"] } },
    [
      {
        $set: {
          stages: {
            $map: {
              input: "$stages",
              as: "stage",
              in: {
                $cond: [
                  { $eq: ["$$stage.id", "award"] },
                  {
                    $arrayToObject: {
                      $filter: {
                        input: { $objectToArray: "$$stage" },
                        as: "kv",
                        cond: { $ne: ["$$kv.k", "agreements"] },
                      },
                    },
                  },
                  "$$stage",
                ],
              },
            },
          },
        },
      },
    ],
  );

  db.collection("cases").updateMany(
    { workflowCode: { $in: ["pigs-might-fly", "frps-private-beta"] } },
    {
      $set: {
        supplementaryData: {},
      },
    },
  );

  db.collection("cases").updateMany(
    { workflowCode: { $in: ["pigs-might-fly", "frps-private-beta"] } },
    [
      {
        $set: {
          supplementaryData: {
            $mergeObjects: [
              "$supplementaryData",
              {
                agreements: {
                  $let: {
                    vars: {
                      award: {
                        $first: {
                          $filter: {
                            input: "$stages",
                            as: "s",
                            cond: { $eq: ["$$s.id", "award"] },
                          },
                        },
                      },
                    },
                    in: {
                      $cond: [
                        {
                          $gt: [
                            { $size: { $ifNull: ["$$award.agreements", []] } },
                            0,
                          ],
                        },
                        "$$award.agreements",
                        null,
                      ],
                    },
                  },
                },
              },
            ],
          },
        },
      },
      {
        $set: {
          stages: {
            $map: {
              input: "$stages",
              as: "stage",
              in: {
                $cond: [
                  { $eq: ["$$stage.id", "award"] },
                  {
                    $arrayToObject: {
                      $filter: {
                        input: { $objectToArray: "$$stage" },
                        as: "kv",
                        cond: { $ne: ["$$kv.k", "agreements"] }, // do not include agreements
                      },
                    },
                  },
                  "$$stage",
                ],
              },
            },
          },
        },
      },
    ],
  );
};

export const down = async (db) => {
  db.collection("cases").updateMany(
    { workflowCode: "pigs-might-fly", "stages.id": "award" },
    [
      {
        $set: {
          stages: {
            $map: {
              input: "$stages",
              as: "stage",
              in: {
                $cond: [
                  { $eq: ["$$stage.id", "award"] },
                  {
                    $mergeObjects: [
                      "$$stage",
                      { agreements: "$supplementaryData.agreements" },
                    ],
                  },
                  "$$stage",
                ],
              },
            },
          },
        },
      },
      { $unset: "supplementaryData.agreements" },
    ],
  );
};
