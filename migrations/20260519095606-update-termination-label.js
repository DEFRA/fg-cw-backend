export const up = async (db) => {
  const terminationComment = {
    label: {
      text: "Reason for termination",
      classes: "",
    },
    helpText: "You must include an explanation for auditing purposes.",
    mandatory: true,
  };

  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        "phases.1.stages.0.statuses.0.transitions.0.action.comment":
          terminationComment,
      },
    },
  );
};
