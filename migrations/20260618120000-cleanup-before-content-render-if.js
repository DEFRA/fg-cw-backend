export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "woodland" },
    {
      $set: {
        "phases.0.stages.0.beforeContent.0.renderIf":
          "jsonata:$.position.statusCode = 'STATUS_APPLICATION_IN_REVIEW'",
        "phases.0.stages.0.beforeContent.1.renderIf":
          "jsonata:$.position.statusCode = 'STATUS_APPLICATION_RECEIVED'",
        "phases.0.stages.0.beforeContent.2.renderIf":
          "jsonata:$.position.statusCode = 'STATUS_AGREEMENT_GENERATING'",
        "phases.0.stages.1.beforeContent.0.renderIf":
          "jsonata:$.position.statusCode = 'STATUS_AGREEMENT_READY_FOR_APPLICANT'",
        "phases.0.stages.2.beforeContent.0.renderIf":
          "jsonata:$.position.statusCode = 'STATUS_AGREEMENT_OFFERED'",
        "phases.0.stages.4.beforeContent.0.renderIf":
          "jsonata:$.position.statusCode = 'STATUS_APPLICATION_AWAITING_FC'",
      },
    },
  );

  await db.collection("workflows").updateOne(
    { code: "frps" },
    {
      $set: {
        "phases.0.stages.0.beforeContent.0.renderIf":
          "jsonata:$.position.statusCode = 'APPLICATION_AMEND'",
        "phases.0.stages.1.beforeContent.0.renderIf":
          "jsonata:$.position.statusCode = 'APPLICATION_AMEND'",
        "phases.0.stages.2.beforeContent.0.renderIf":
          "jsonata:$.position.statusCode = 'AGREEMENT_OFFERED'",
        "phases.0.stages.2.beforeContent.1.renderIf":
          "jsonata:$.position.statusCode = 'APPLICATION_AMEND'",
        "phases.1.stages.0.beforeContent.0.renderIf":
          "jsonata:$.position.statusCode = 'AGREEMENT_ACCEPTED'",
        "phases.1.stages.1.beforeContent.0.renderIf":
          "jsonata:$.position.statusCode = 'AGREEMENT_TERMINATED'",
      },
    },
  );
};
