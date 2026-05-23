export const up = async (db) => {
  const workflowQuery = { code: "pigs-might-fly" };

  await db.collection("workflows").updateOne(workflowQuery, {
    $set: {
      templates: {
        "pmf-template": {
          "pmf-example": {
            content: [
              {
                id: "title",
                component: "heading",
                text: "PMF Template",
                level: 2,
              },
              {
                id: "totalPigs",
                component: "summary-list",
                rows: [
                  {
                    label: "Total Pigs",
                    text: "@.totalPigs",
                  },
                  {
                    label: "White Pigs",
                    text: "@.whitePigsCount",
                  },
                ],
              },
            ],
          },
        },
      },
    },
  });

  await db.collection("workflows").updateOne(workflowQuery, {
    $push: {
      "pages.cases.details.tabs.case-details.content": {
        $each: [
          {
            component: "template",
            dataRef: "$.payload.answers",
            templateRef: "$.templates.pmf-template",
            templateKey: "pmf-example",
          },
        ],
        $position: 3,
      },
    },
  });
};
