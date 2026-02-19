export const up = async (db) => {
  const summaryListRows = [
    {
      label: "Agreement status",
      text: [
        {
          component: "status",
          text: "jsonata:$sort($.supplementaryData.agreements, function($l, $r) { $l.createdAt < $r.createdAt })[0].agreementStatus",
          labelsMap: {
            AGREEMENT_DRAFTED: "Agreement drafted",
            OFFERED: "Offered",
            ACCEPTED: "Accepted",
            WITHDRAWN: "Withdrawn",
            REJECTED: "Rejected",
          },
        },
      ],
    },
    {
      label: "Reference",
      text: "jsonata:$sort($.supplementaryData.agreements, function($l, $r) { $l.createdAt < $r.createdAt })[0].agreementRef",
    },
    {
      label: "Date accepted",
      text: "jsonata:$exists($max($.supplementaryData.agreements[agreementStatus='ACCEPTED'].$toMillis(acceptedDate))) ? $fromMillis($max($.supplementaryData.agreements[agreementStatus='ACCEPTED'].$toMillis(acceptedDate)), '[D] [MNn,*-3] [Y]') : 'Not accepted'",
    },
    {
      label: "Start date",
      text: "jsonata:$exists($max($.supplementaryData.agreements[agreementStatus='ACCEPTED'].$toMillis(startDate))) ? $fromMillis($max($.supplementaryData.agreements[agreementStatus='ACCEPTED'].$toMillis(startDate)), '[D] [MNn,*-3] [Y]') : 'Not started'",
    },
    {
      label: "End date",
      text: "jsonata:$exists($max($.supplementaryData.agreements[agreementStatus='ACCEPTED'].$toMillis(endDate))) ? $fromMillis($max($.supplementaryData.agreements[agreementStatus='ACCEPTED'].$toMillis(endDate)), '[D] [MNn,*-3] [Y]') : 'Not started'",
    },
    {
      label: "View",
      text: [
        {
          component: "url",
          text: "View agreement",
          href: {
            urlTemplate: "$.definitions.agreementsService.internalUrl",
            params: {
              agreementRef:
                "jsonata:$sort($.supplementaryData.agreements, function($l, $r) { $l.createdAt < $r.createdAt })[0].agreementRef",
            },
          },
          target: "_blank",
          rel: "noopener",
        },
      ],
    },
  ];

  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        "pages.cases.details.tabs.agreements.content.1.rows": summaryListRows,
      },
    },
  );
};
