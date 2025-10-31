export const up = async (db) => {
  await db.collection("cases").updateMany({}, [
    {
      $set: {
        currentPhase: "default",
        phases: [
          {
            code: "default",
            stages: "$stages",
          },
        ],
      },
    },
  ]);
};

export const down = async (db) => {
  await db.collection("cases").updateMany({}, []);
};
