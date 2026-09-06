const configVersionFields = [
  {
    component: "paragraph",
    text: "Original configuration version $.originalConfigVersion",
    classes: "govuk-body",
  },
  {
    component: "paragraph",
    text: "Current configuration version $.currentConfigVersion",
    classes: "govuk-body",
  },
];

export const up = async (db) => {
  const workflows = db.collection("workflows");

  await workflows.updateMany(
    { code: { $in: ["woodland", "frps-private-beta", "pigs-might-fly"] } },
    {
      $push: {
        "pages.cases.details.tabs.case-details.content": {
          $each: configVersionFields,
        },
      },
    },
  );
};
