export const up = async (db) => {
  db.collection("workflows").updateMany(
    { workflowCode: { $in: ["pigs-might-fly", "frps-private-beta"] } },
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
        supplementaryData: {
          agreements: {},
        },
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
                        {
                          $arrayToObject: {
                            $map: {
                              input: { $ifNull: ["$$award.agreements", []] },
                              as: "a",
                              in: {
                                k: "$$a.agreementRef",
                                v: {
                                  $arrayToObject: {
                                    $filter: {
                                      input: { $objectToArray: "$$a" },
                                      as: "kv",
                                      cond: { $ne: ["$$kv.k", "agreementRef"] },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                        {},
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
    { workflowCode: { $in: ["pigs-might-fly", "frps-private-beta"] } },
    [
      {
        $set: {
          _agreementsFromSupp: {
            $map: {
              input: {
                $objectToArray: {
                  $ifNull: ["$supplementaryData.agreements", {}],
                },
              },
              as: "agr",
              in: {
                $mergeObjects: [{ agreementRef: "$$agr.k" }, "$$agr.v"],
              },
            },
          },
        },
      },
      {
        $set: {
          stages: {
            $let: {
              vars: {
                hasAward: {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: "$stages",
                          as: "stage",
                          cond: { $eq: ["$$stage.id", "award"] },
                        },
                      },
                    },
                    0,
                  ],
                },
              },
              in: {
                $cond: [
                  "$$hasAward",
                  {
                    $map: {
                      input: "$stages",
                      as: "stage",
                      in: {
                        $cond: [
                          { $eq: ["$$stage.id", "award"] },
                          {
                            $mergeObjects: [
                              "$$stage",
                              { agreements: "$_agreementsFromSupp" },
                            ],
                          },
                          "$$stage",
                        ],
                      },
                    },
                  },
                  {},
                ],
              },
            },
          },
        },
      },
      {
        $unset: "supplementaryData",
      },
      { $unset: "_agreementsFromSupp" },
    ],
  );
};
