export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "pigs-might-fly" },
    {
      $set: {
        "stages.0.actionsTitle": "Decision",
        "stages.0.actions.0.id": "approve",
        "stages.0.actions.0.comment": {
          label: "Approval reason note",
          helpText: "All notes will be saved for auditing purposes",
          type: "REQUIRED",
        },
        "stages.0.actions.1.comment": {
          label: "Note (optional)",
          helpText: "All notes will be saved for auditing purposes",
          type: "OPTIONAL",
        },
      },
    },
  );
};

export const down = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "pigs-might-fly" },
    {
      $set: {
        "stages.0.actions.0.id": "accept",
      },
      $unset: {
        "stages.0.actions.0.comment": "",
        "stages.0.actions.1.comment": "",
      },
    },
  );
};
