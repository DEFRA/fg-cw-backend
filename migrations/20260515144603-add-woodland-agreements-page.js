import { config } from "../src/common/config.js";

const definitionsByEnvironment = {
  local: {
    agreementsService: {
      internalUrl: "http://localhost:3000/agreement/{agreementRef}",
    },
  },
  dev: {
    agreementsService: {
      internalUrl:
        "https://fg-cw-frontend.dev.cdp-int.defra.cloud/agreement/{agreementRef}",
    },
  },
  test: {
    agreementsService: {
      internalUrl:
        "https://fg-cw-frontend.test.cdp-int.defra.cloud/agreement/{agreementRef}",
    },
  },
  "perf-test": {
    agreementsService: {
      internalUrl:
        "https://fg-cw-frontend.perf-test.cdp-int.defra.cloud/agreement/{agreementRef}",
    },
  },
  "ext-test": {
    agreementsService: {
      internalUrl:
        "https://fg-cw-frontend.ext-test.cdp-int.defra.cloud/agreement/{agreementRef}",
    },
  },
  prod: {
    agreementsService: {
      internalUrl:
        "https://fg-cw-frontend.prod.cdp-int.defra.cloud/agreement/{agreementRef}",
    },
  },
};

export const up = async (db) => {
  const environment = config.get("cdpEnvironment");
  const definitions = definitionsByEnvironment[environment];

  if (!definitions) {
    throw new Error(
      `No workflow definitions configured for environment: ${environment}`,
    );
  }

  const result = await db.collection("workflows").updateOne(
    { code: "woodland" },
    {
      $set: {
        "definitions.agreementsService": definitions.agreementsService,
        "pages.cases.details.tabs.agreements": {
          link: {
            id: "agreements",
            href: {
              urlTemplate: "/cases/{caseId}/agreements",
              params: {
                caseId: "$._id",
              },
            },
            text: "Agreements",
            index: 2,
          },
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
                      themeMap: {
                        AGREEMENT_GENERATING: "INFO",
                        AGREEMENT_DRAFTED: "INFO",
                        OFFERED: "NOTICE",
                        ACCEPTED: "SUCCESS",
                        WITHDRAWN: "WARN",
                        REJECTED: "ERROR",
                        TERMINATED: "ERROR",
                        CANCELLED: "WARN",
                      },
                      labelsMap: {
                        AGREEMENT_GENERATING: "Agreement generating",
                        AGREEMENT_DRAFTED: "Agreement drafted",
                        OFFERED: "Offered",
                        ACCEPTED: "Accepted",
                        WITHDRAWN: "Withdrawn",
                        REJECTED: "Rejected",
                        TERMINATED: "Terminated",
                        CANCELLED: "Cancelled",
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
                  text: "jsonata:$exists($max($.supplementaryData.agreements[agreementStatus='ACCEPTED'].$toMillis(acceptedDate))) ? $fromMillis($max($.supplementaryData.agreements[agreementStatus='ACCEPTED'].$toMillis(acceptedDate)), '[D] [MNn,*-3] [Y]') : 'Not accepted'",
                },
                {
                  label: "Start date",
                  text: "jsonata:$exists($max($.supplementaryData.agreements[agreementStatus='ACCEPTED'].$toMillis(startDate))) ? $fromMillis($max($.supplementaryData.agreements[agreementStatus='ACCEPTED'].$toMillis(startDate)), '[D] [MNn,*-3] [Y]') : 'Not started'",
                },
                {
                  label: "View",
                  text: [
                    {
                      component: "url",
                      text: "View agreement",
                      href: {
                        urlTemplate:
                          "$.definitions.agreementsService.internalUrl",
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
          ],
        },
      },
    },
  );

  if (result.matchedCount === 0) {
    throw new Error("Workflow not found: woodland");
  }
};
