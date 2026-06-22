export const up = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $push: {
        "pages.cases.details.tabs.agreements.content.1.rows": {
          $each: [
            {
              label: "End date",
              text: "jsonata:$sort($.supplementaryData.agreements, function($l, $r) { $l.createdAt < $r.createdAt })[0].startDate ? $formatTime($toMillis($sort($.supplementaryData.agreements, function($l, $r) { $l.createdAt < $r.createdAt })[0].endDate), '[D] [MNn] [Y]') : 'Not started'",
            },
          ],
          $position: 4,
        },
      },
    },
  );
};

export const down = async (db) => {
  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $pull: {
        "pages.cases.details.tabs.agreements.content.1.rows": {
          label: "End date",
        },
      },
    },
  );
};
