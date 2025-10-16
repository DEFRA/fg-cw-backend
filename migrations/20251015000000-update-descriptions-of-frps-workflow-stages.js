export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        "stages.0.description": "Application received",
        "stages.1.description": "Awaiting agreement",
        "stages.2.description": "Agreement signed",
      },
    },
  );
};

export const down = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $unset: {
        "stages.0.description": "",
        "stages.1.description": "",
        "stages.2.description": "",
      },
    },
  );
};
