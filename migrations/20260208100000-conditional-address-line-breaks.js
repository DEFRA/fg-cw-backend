/**
 * Make address line-breaks conditional so blank lines are not rendered
 * when optional fields are missing
 *
 * Changes:
 * - Update workflow caseDetails tab Address row to use conditional line-breaks
 *   for line1 through line5
 */

export const up = async (db) => {
  const workflowQuery = { code: "frps-private-beta" };

  const newAddressRow = {
    label: "Address",
    text: [
      {
        component: "text",
        text: "$.payload.answers.applicant.business.address.line1",
      },
      { component: "line-break" },
      {
        component: "text",
        text: "$.payload.answers.applicant.business.address.line2",
      },
      {
        component: "conditional",
        condition: "$.payload.answers.applicant.business.address.line2",
        whenTrue: { component: "line-break" },
      },
      {
        component: "text",
        text: "$.payload.answers.applicant.business.address.line3",
      },
      {
        component: "conditional",
        condition: "$.payload.answers.applicant.business.address.line3",
        whenTrue: { component: "line-break" },
      },
      {
        component: "text",
        text: "$.payload.answers.applicant.business.address.line4",
      },
      {
        component: "conditional",
        condition: "$.payload.answers.applicant.business.address.line4",
        whenTrue: { component: "line-break" },
      },
      {
        component: "text",
        text: "$.payload.answers.applicant.business.address.line5",
      },
      {
        component: "conditional",
        condition: "$.payload.answers.applicant.business.address.line5",
        whenTrue: { component: "line-break" },
      },
      {
        component: "text",
        text: "$.payload.answers.applicant.business.address.street",
      },
      { component: "line-break" },
      {
        component: "text",
        text: "$.payload.answers.applicant.business.address.city",
      },
      {
        component: "text",
        text: "$.payload.answers.applicant.business.address.postalCode",
      },
    ],
  };

  // Indexes for navigating the workflow structure
  const CASE_DETAILS_TAB = "case-details";
  const CUSTOMER_DETAILS_ACCORDION_INDEX = 0;
  const ADDRESS_ROW_INDEX = 2;

  // Update workflow definition - caseDetails tab address row
  await db.collection("workflows").updateOne(workflowQuery, {
    $set: {
      [`pages.cases.details.tabs.${CASE_DETAILS_TAB}.content.2.items.${CUSTOMER_DETAILS_ACCORDION_INDEX}.content.0.rows.${ADDRESS_ROW_INDEX}`]:
        newAddressRow,
    },
  });
};
