export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "woodland" },
    {
      $set: {
        "phases.$[phase].stages.$[stage].beforeContent.$[bc].content": [
          {
            component: "paragraph",
            text: "Select 'Generate agreement' if you are ready to continue. If the customer needs to make amendments select 'Return to customer'.",
          },
        ],
      },
    },
    {
      arrayFilters: [
        { "phase.code": "PHASE_PRE_AWARD" },
        { "stage.code": "STAGE_REVIEWING_APPLICATION" },
        {
          "bc.renderIf":
            "jsonata:$.position.statusCode = 'STATUS_APPLICATION_IN_REVIEW'",
        },
      ],
    },
  );
};
