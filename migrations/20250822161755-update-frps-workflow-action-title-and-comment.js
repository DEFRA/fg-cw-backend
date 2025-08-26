export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        "stages.0.actionsTitle": "Decision",
        "stages.0.actions.0.comment": {
          label: "Approval reason note",
          helpText: "All notes will be saved for auditing purposes",
          type: "REQUIRED",
        },
      },
    },
  );
};

export const down = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $unset: {
        "stages.0.actionsTitle": "",
        "stages.0.actions.0.comment": "",
      },
    },
  );
};
