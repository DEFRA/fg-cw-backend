export const up = async (db, _client, context) => {
  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        "pages.cases.details.tabs.agreements.content.2.rows.2.items": [
          {
            label: "Internal",
            component: "url",
            text: "Internal",
            href: {
              urlTemplate: "$.definitions.agreementsService.internalUrl",
              params: { agreementRef: "@.agreementRef" },
            },
            target: "_blank",
            rel: "noopener",
            classes: "govuk-!-margin-right-6",
          },
        ],
      },
    },
  );
};
