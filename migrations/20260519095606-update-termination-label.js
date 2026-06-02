export const up = async (db) => {
  const terminationComment = {
    label: {
      text: "Reason for termination",
      classes: "govuk-label--s",
    },
    helpText: "You must include an explanation for auditing purposes.",
    mandatory: true,
  };

  const workflow = await db
    .collection("workflows")
    .findOne({ code: "frps-private-beta" });

  if (!workflow) {
    return;
  }

  const content =
    workflow.phases?.[1]?.stages?.[0]?.beforeContent?.[0]?.content;

  const update = {
    $set: {
      "phases.1.stages.0.statuses.0.transitions.0.action.comment":
        terminationComment,
    },
  };

  if (content?.length === 6) {
    update.$pop = { "phases.1.stages.0.beforeContent.0.content": 1 };
  }

  await db
    .collection("workflows")
    .updateOne({ code: "frps-private-beta" }, update);
};
