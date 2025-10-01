export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $pull: {
        "pages.cases.details.tabs.agreements.content": {
          id: "agreementName",
        },
      },
    },
  );
};

export const down = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $push: {
        "pages.cases.details.tabs.agreements.content": {
          $position: 2,
          $each: [
            {
              id: "agreementName",
              component: "container",
              classes: "govuk-body",
              items: [
                {
                  text: "Agreement name:",
                  classes: "govuk-!-font-weight-bold",
                },
                {
                  text: "[agreement name]",
                },
              ],
            },
          ],
        },
      },
    },
  );
};
