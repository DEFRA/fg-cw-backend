export const up = async (db) => {
  await db.collection("workflows").updateMany(
    {},
    {
      $push: {
        stages: {
          $each: [
            {
              id: "AWARD",
              title: "Award",
              agreements: [],
            },
          ],
        },
      },
    },
  );

  await db.collection("workflows").updateMany({}, [
    {
      $set: {
        phases: {
          PRE_AWARD: {
            stages: {
              $arrayToObject: {
                $map: {
                  input: "$stages",
                  as: "stage",
                  in: {
                    k: "$$stage.id",
                    v: "$$stage",
                  },
                },
              },
            },
          },
        },
      },
    },
  ]);

  await db.collection("workflows").updateMany(
    {},
    {
      $unset: {
        stages: "",
      },
    },
  );

  await db.collection("cases").updateMany(
    {},
    {
      $set: {
        currentPhase: "PRE_AWARD",
      },
      $push: {
        stages: {
          $each: [
            {
              id: "AWARD",
              title: "Award",
              agreements: [],
            },
          ],
        },
      },
    },
  );

  await db.collection("cases").updateMany({}, [
    {
      $set: {
        phases: {
          PRE_AWARD: {
            stages: {
              $arrayToObject: {
                $map: {
                  input: "$stages",
                  as: "stage",
                  in: {
                    k: "$$stage.id",
                    v: "$$stage",
                  },
                },
              },
            },
          },
        },
      },
    },
  ]);

  await db.collection("cases").updateMany(
    {},
    {
      $unset: {
        stages: "",
      },
    },
  );
};

export const down = async (db) => {
  await db.collection("cases").updateMany(
    {},
    {
      $unset: {
        "phases.PRE_AWARD.stages.AWARD": "",
        currentPhase: "",
      },
    },
  );

  await db.collection("cases").updateMany({}, [
    {
      $set: {
        stages: {
          $map: {
            input: { $objectToArray: "$phases.PRE_AWARD.stages" },
            as: "stage",
            in: "$$stage.v",
          },
        },
      },
    },
  ]);

  await db.collection("cases").updateMany(
    {},
    {
      $unset: { phases: "" },
    },
  );

  await db.collection("workflows").updateMany(
    {},
    {
      $unset: {
        "phases.PRE_AWARD.stages.AWARD": "",
        currentPhase: "",
      },
    },
  );

  await db.collection("workflows").updateMany({}, [
    {
      $set: {
        stages: {
          $map: {
            input: { $objectToArray: "$phases.PRE_AWARD.stages" },
            as: "stage",
            in: "$$stage.v",
          },
        },
      },
    },
  ]);

  await db.collection("workflow").updateMany(
    {},
    {
      $unset: { phases: "" },
    },
  );
};
