export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        "phases.0.stages.0.taskGroups.0.tasks.2.conditional":
          "$.payload.answers.rulesCalculations.caveats[?(@.code=='ne-consent-required')]",
      },
    },
  );
};
