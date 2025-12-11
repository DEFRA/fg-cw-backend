export const up = async (db) => {
  const newAgreementsTab = {
    renderIf: "$.supplementaryData.agreements[0]",
    content: [
      {
        id: "title",
        component: "heading",
        text: "Funding agreement",
        level: 2,
        classes: "govuk-!-margin-top-6",
      },
      {
        component: "summary-list",
        rows: [
          {
            label: "Agreement status",
            text: [
              {
                component: "status",
                text: "jsonata:$sort($.supplementaryData.agreements, function($l, $r) { $l.createdAt < $r.createdAt })[0].agreementStatus",
                classesMap: {
                  OFFERED: "govuk-tag--yellow",
                  ACCEPTED: "govuk-tag--blue",
                  AGREEMENT_DRAFTED: "govuk-tag--blue",
                  WITHDRAWN: "govuk-tag--grey",
                  REJECTED: "govuk-tag--grey",
                },
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
            label: "Date created",
            text: "jsonata:$sort($.supplementaryData.agreements, function($l, $r) { $l.createdAt < $r.createdAt })[0].createdAt",
            format: "formatDate",
          },
          {
            label: "Date accepted",
            text: "jsonata:$sort($.supplementaryData.agreements, function($l, $r) { $l.createdAt < $r.createdAt })[0].agreementStatus = 'ACCEPTED' ? $formatTime($toMillis($sort($.supplementaryData.agreements, function($l, $r) { $l.createdAt < $r.createdAt })[0].acceptedAt), '[D] [MNn] [Y]') : 'Not accepted'",
          },
          {
            label: "Start date",
            text: "jsonata:$sort($.supplementaryData.agreements, function($l, $r) { $l.createdAt < $r.createdAt })[0].startDate ? $formatTime($toMillis($sort($.supplementaryData.agreements, function($l, $r) { $l.createdAt < $r.createdAt })[0].startDate), '[D] [MNn] [Y]') : 'Not started'",
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
        ],
      },
      {
        component: "conditional",
        condition: "jsonata:$count($.supplementaryData.agreements) > 1",
        whenTrue: {
          component: "container",
          items: [
            {
              id: "version-history-title",
              component: "heading",
              text: "Version history",
              level: 3,
              classes: "govuk-!-margin-top-6",
            },
            {
              type: "array",
              component: "table",
              rowsRef:
                "jsonata:$filter($sort($.supplementaryData.agreements, function($l, $r) { $l.createdAt < $r.createdAt }), function($v, $i) { $i > 0 })",
              rows: [
                {
                  label: "Reference",
                  text: "@.agreementRef",
                },
                {
                  label: "Date",
                  text: "@.createdAt",
                  format: "formatDate",
                },
                {
                  label: "Status",
                  component: "status",
                  text: "@.agreementStatus",
                  classesMap: {
                    OFFERED: "govuk-tag--yellow",
                    ACCEPTED: "govuk-tag--blue",
                    AGREEMENT_DRAFTED: "govuk-tag--blue",
                    WITHDRAWN: "govuk-tag--grey",
                    REJECTED: "govuk-tag--grey",
                  },
                  labelsMap: {
                    AGREEMENT_DRAFTED: "Agreement drafted",
                    OFFERED: "Offered",
                    ACCEPTED: "Accepted",
                    WITHDRAWN: "Withdrawn",
                    REJECTED: "Rejected",
                  },
                },
                {
                  label: "",
                  component: "url",
                  text: "View this version",
                  href: {
                    urlTemplate: "$.definitions.agreementsService.internalUrl",
                    params: {
                      agreementRef: "@.agreementRef",
                    },
                  },
                  target: "_blank",
                  rel: "noopener",
                },
              ],
            },
          ],
        },
      },
    ],
  };

  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        "pages.cases.details.tabs.agreements": newAgreementsTab,
      },
    },
  );
};

export const down = async (db) => {
  const oldAgreementsTab = {
    renderIf: "$.supplementaryData.agreements[0]",
    content: [
      {
        id: "title",
        component: "heading",
        text: "Case grant funding agreement",
        level: 2,
        classes: "govuk-!-margin-top-6",
      },
      {
        id: "subtitle",
        component: "heading",
        text: "Check the grant funding agreement system to see the final terms of the agreement.",
        level: 3,
        classes: "govuk-inset-text",
      },
      {
        type: "array",
        component: "table",
        rowsRef: "$.supplementaryData.agreements[*]",
        rows: [
          {
            label: "Reference",
            text: "@.agreementRef",
          },
          {
            label: "Date",
            text: "@.createdAt",
            type: "date",
            format: "formatDate",
          },
          {
            id: "internal",
            component: "container",
            label: "View",
            items: [
              {
                label: "Internal",
                component: "url",
                text: "Internal",
                href: {
                  urlTemplate: "$.definitions.agreementsService.internalUrl",
                  params: {
                    agreementRef: "@.agreementRef",
                  },
                },
                target: "_blank",
                rel: "noopener",
                classes: "govuk-!-margin-right-6",
              },
            ],
          },
          {
            label: "Status",
            component: "status",
            text: "@.agreementStatus",
            classesMap: {
              OFFERED: "govuk-tag--yellow",
              ACCEPTED: "govuk-tag--blue",
              WITHDRAWN: "govuk-tag--grey",
            },
          },
        ],
      },
    ],
  };

  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        "pages.cases.details.tabs.agreements": oldAgreementsTab,
      },
    },
  );
};
