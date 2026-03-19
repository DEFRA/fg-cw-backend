/**
 * Add Address Line 4 and Line 5 to the Application tab
 *
 * Changes:
 * - Update workflow caseDetails tab to display address line4 and line5 fields
 */

export const up = async (db) => {
  const workflowQuery = { code: "frps-private-beta" };

  // Updated Address row with line4 and line5 included
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
      { component: "line-break" },
      {
        component: "text",
        text: "$.payload.answers.applicant.business.address.line3",
      },
      { component: "line-break" },
      {
        component: "text",
        text: "$.payload.answers.applicant.business.address.line4",
      },
      { component: "line-break" },
      {
        component: "text",
        text: "$.payload.answers.applicant.business.address.line5",
      },
      { component: "line-break" },
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
