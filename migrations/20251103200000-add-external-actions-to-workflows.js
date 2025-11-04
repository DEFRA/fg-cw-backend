export const up = async (db) => {
  const externalActions = [
    {
      code: "RERUN_RULES",
      name: "Rerun Rules",
      description: "Rerun the business rules validation",
      endpoint: "landGrantsRulesRerun",
      target: {
        position: "PRE_AWARD:REVIEW_APPLICATION:IN_PROGRESS",
        node: "landGrantsRulesRun",
        nodeType: "array",
        place: "append",
      },
    },
  ];

  await db
    .collection("workflows")
    .updateOne({ code: "frps-private-beta" }, { $set: { externalActions } });

  await db
    .collection("workflows")
    .updateOne({ code: "pigs-might-fly" }, { $set: { externalActions } });
};

export const down = async (db) => {
  await db
    .collection("workflows")
    .updateOne(
      { code: "frps-private-beta" },
      { $unset: { externalActions: "" } },
    );

  await db
    .collection("workflows")
    .updateOne({ code: "pigs-might-fly" }, { $unset: { externalActions: "" } });
};
