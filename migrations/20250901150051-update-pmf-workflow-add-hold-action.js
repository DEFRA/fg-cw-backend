export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "pigs-might-fly" },
    {
      $push: {
        "stages.0.actions": {
          $position: 1,
          $each: [
            {
              id: "hold",
              label: "Put on hold",
              comment: {
                label: "Note (optional)",
                helpText: "All notes will be saved for auditing purposes",
                type: "OPTIONAL",
              },
            },
          ],
        },
      },
    },
  );
};

export const down = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "pigs-might-fly" },
    {
      $pull: {
        "stages.0.actions": { id: "hold" },
      },
    },
  );
};
