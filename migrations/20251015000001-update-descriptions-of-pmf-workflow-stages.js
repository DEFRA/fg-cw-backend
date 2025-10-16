export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "pigs-might-fly" },
    {
      $set: {
        "stages.0.description": "Application received",
        "stages.1.description": "Application assessment",
        "stages.2.description": "Awaiting agreement",
        "stages.3.description": "Agreement signed",
      },
    },
  );
};

export const down = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "pigs-might-fly" },
    {
      $unset: {
        "stages.0.description": "",
        "stages.1.description": "",
        "stages.2.description": "",
        "stages.3.description": "",
      },
    },
  );
};
