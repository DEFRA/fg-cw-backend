export const up = async (db) => {
  const workflowQuery = { code: "frps-private-beta" };

  // Update phone path in workflow definition from phone.mobile to phone
  await db.collection("workflows").updateOne(workflowQuery, {
    $set: {
      "pages.cases.details.tabs.case-details.content.2.items.0.content.0.rows.4.text.2.text":
        "$.payload.answers.applicant.business.phone",
    },
  });

  // Update existing cases: convert phone from object { mobile: "..." } to string
  const casesQuery = {
    workflowCode: "frps-private-beta",
    "payload.answers.applicant.business.phone.mobile": { $exists: true },
  };

  const casesToUpdate = await db.collection("cases").find(casesQuery).toArray();

  for (const caseDoc of casesToUpdate) {
    const phoneNumber = caseDoc.payload.answers.applicant.business.phone.mobile;

    await db.collection("cases").updateOne(
      { _id: caseDoc._id },
      {
        $set: {
          "payload.answers.applicant.business.phone": phoneNumber,
        },
      },
    );
  }
};
