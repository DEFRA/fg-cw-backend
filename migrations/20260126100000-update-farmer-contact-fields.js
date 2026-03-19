/**
 * FGP-873: Update farmer contact fields to be optional with flat structure
 *
 * Changes:
 * - Update workflow caseDetails tab to show contact fields conditionally
 * - Migrate existing case data from nested to flat contact structure
 */

export const up = async (db) => {
  const workflowQuery = { code: "frps-private-beta" };

  // New contact details row with conditional rendering for optional fields
  const newContactDetailsRow = {
    label: "Contact details",
    text: [
      {
        component: "conditional",
        condition: "$.payload.answers.applicant.business.email",
        whenTrue: {
          component: "container",
          items: [
            {
              component: "text",
              text: "$.payload.answers.applicant.business.email",
            },
            { component: "line-break" },
          ],
        },
      },
      {
        component: "conditional",
        condition: "$.payload.answers.applicant.business.landlinePhoneNumber",
        whenTrue: {
          component: "container",
          items: [
            {
              component: "text",
              text: "$.payload.answers.applicant.business.landlinePhoneNumber",
            },
            { component: "line-break" },
          ],
        },
      },
      {
        component: "conditional",
        condition: "$.payload.answers.applicant.business.mobilePhoneNumber",
        whenTrue: {
          component: "text",
          text: "$.payload.answers.applicant.business.mobilePhoneNumber",
        },
      },
    ],
  };

  // Indexes for navigating the workflow structure
  const CASE_DETAILS_TAB = "case-details";
  const CUSTOMER_DETAILS_ACCORDION_INDEX = 0;
  const CONTACT_DETAILS_ROW_INDEX = 4;

  // Update workflow definition - caseDetails tab contact details row
  await db.collection("workflows").updateOne(workflowQuery, {
    $set: {
      [`pages.cases.details.tabs.${CASE_DETAILS_TAB}.content.2.items.${CUSTOMER_DETAILS_ACCORDION_INDEX}.content.0.rows.${CONTACT_DETAILS_ROW_INDEX}`]:
        newContactDetailsRow,
    },
  });

  // Migrate existing case data from nested to flat structure
  const cases = await db
    .collection("cases")
    .find({
      workflowCode: "frps-private-beta",
      "payload.answers.applicant.business": { $exists: true },
    })
    .toArray();

  for (const doc of cases) {
    const business = doc.payload?.answers?.applicant?.business;
    if (!business) continue;

    const updates = {};
    const unsets = {};

    // Transform email.address to email (flat string)
    if (business.email?.address) {
      updates["payload.answers.applicant.business.email"] =
        business.email.address;
    } else if (typeof business.email === "object" && business.email !== null) {
      // Remove the old nested email object if it exists but has no address
      unsets["payload.answers.applicant.business.email"] = "";
    }

    // Transform phone.mobile to mobilePhoneNumber
    if (business.phone?.mobile) {
      updates["payload.answers.applicant.business.mobilePhoneNumber"] =
        business.phone.mobile;
    }

    // Remove old nested phone object
    if (business.phone) {
      unsets["payload.answers.applicant.business.phone"] = "";
    }

    // Apply updates if there are any changes
    const updateOps = {};
    if (Object.keys(updates).length > 0) {
      updateOps.$set = updates;
    }
    if (Object.keys(unsets).length > 0) {
      updateOps.$unset = unsets;
    }

    if (Object.keys(updateOps).length > 0) {
      await db.collection("cases").updateOne({ _id: doc._id }, updateOps);
    }
  }
};
