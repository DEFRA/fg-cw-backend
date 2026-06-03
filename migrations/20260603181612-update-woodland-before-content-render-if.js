export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "woodland" },
    {
      $set: {
        "phases.0.stages.0.beforeContent.0.renderIf":
          "jsonata:$.request.params.tabId = 'tasks' and $.position.statusCode = 'STATUS_APPLICATION_IN_REVIEW'",
        "phases.0.stages.0.beforeContent.1.renderIf":
          "jsonata:$.request.params.tabId = 'tasks' and $.position.statusCode = 'STATUS_APPLICATION_RECEIVED'",
        "phases.0.stages.0.beforeContent.2.renderIf":
          "jsonata:$.request.params.tabId = 'tasks' and $.position.statusCode = 'STATUS_AGREEMENT_GENERATING'",
        "phases.0.stages.1.beforeContent.0.renderIf":
          "jsonata:$.request.params.tabId = 'tasks' and $.position.statusCode = 'STATUS_AGREEMENT_READY_FOR_APPLICANT'",
        "phases.0.stages.2.beforeContent.0.renderIf":
          "jsonata:$.request.params.tabId = 'tasks' and $.position.statusCode = 'STATUS_AGREEMENT_OFFERED'",
        "phases.0.stages.4.beforeContent.0.renderIf":
          "jsonata:$.request.params.tabId = 'tasks' and $.position.statusCode = 'STATUS_APPLICATION_AWAITING_FC'",
      },
    },
  );
};
