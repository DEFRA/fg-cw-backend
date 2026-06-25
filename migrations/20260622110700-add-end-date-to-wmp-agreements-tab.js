export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "woodland" },
    {
      $push: {
        "pages.cases.details.tabs.agreements.content.1.rows": {
          $each: [
            {
              label: "End date",
              text: "jsonata:$exists($max($.supplementaryData.agreements[agreementStatus='ACCEPTED'].$toMillis(endDate))) ? $fromMillis($max($.supplementaryData.agreements[agreementStatus='ACCEPTED'].$toMillis(endDate)), '[D] [MNn,*-3] [Y]') : 'Not started'",
            },
          ],
          $position: 5,
        },
      },
    },
  );
};
