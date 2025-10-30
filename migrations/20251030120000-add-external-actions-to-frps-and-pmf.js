export const up = async (db) => {
  const externalActions = [
    {
      code: "RERUN_RULES",
      name: "Rerun Rules",
      endpoint: "landGrantsRulesRerun",
      target: {
        node: "rulesHistory",
        nodeType: "array",
        position: "append",
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
