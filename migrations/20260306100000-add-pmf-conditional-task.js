const checkWhitePigsTask = {
  conditional: "$.payload.answers[?(@property == 'whitePigsCount' && @ > 3)]",
  code: "CHECK_WHITE_PIGS",
  name: "Check number of White Pigs",
  mandatory: true,
  description: [
    {
      component: "heading",
      text: "Check number of White Pigs",
      level: 2,
      classes: "govuk-!-margin-bottom-3",
    },
    {
      component: "paragraph",
      text: "Review the number of White Pigs declared in the application when the count exceeds 3.",
      classes: "govuk-body",
    },
  ],
  statusOptions: [
    {
      code: "ACCEPTED",
      name: "Accepted",
      theme: "NONE",
      altName: "Accept",
      completes: true,
    },
    {
      code: "RFI",
      name: "Information requested",
      theme: "NOTICE",
      altName: "Request information from customer",
      completes: false,
    },
  ],
};

export const up = async (db) => {
  const workflowQuery = { code: "pigs-might-fly" };

  await db.collection("workflows").updateOne(workflowQuery, {
    $push: {
      "phases.0.stages.0.taskGroups.0.tasks": checkWhitePigsTask,
    },
  });
};

export const down = async (db) => {
  const workflowQuery = { code: "pigs-might-fly" };

  await db.collection("workflows").updateOne(workflowQuery, {
    $pull: {
      "phases.0.stages.0.taskGroups.0.tasks": { code: "CHECK_WHITE_PIGS" },
    },
  });
};
