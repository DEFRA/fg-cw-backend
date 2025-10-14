export const up = async (db) => {
  await db
    .collection("workflows")
    .updateMany({ "stages.title": { $exists: true } }, [
      {
        $set: {
          stages: {
            $map: {
              input: "$stages",
              as: "stage",
              in: {
                $mergeObjects: ["$$stage", { name: "$$stage.title" }],
              },
            },
          },
        },
      },
      { $unset: "stages.title" },
    ]);
};

export const down = async (db) => {
  await db
    .collection("workflows")
    .updateMany({ "stages.name": { $exists: true } }, [
      {
        $set: {
          stages: {
            $map: {
              input: "$stages",
              as: "stage",
              in: {
                $mergeObjects: ["$$stage", { title: "$$stage.name" }],
              },
            },
          },
        },
      },
      { $unset: "stages.name" },
    ]);
};
