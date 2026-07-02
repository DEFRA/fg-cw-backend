const CASE_REF = "wmp-2ax-726";
const WORKFLOW_CODE = "woodland";
const BAD_PENCE = { $gt: 238769, $lt: 238770 };
const CASE_CREATE_EVENT_TYPE =
  /^cloud\.defra\.[^.]+\.fg-gas-backend\.case\.create$/;
const FIXED_PENCE = 238770;

export const up = async (db) => {
  await db.collection("cases").updateOne(
    {
      caseRef: CASE_REF,
      workflowCode: WORKFLOW_CODE,
      "payload.answers.totalAgreementPaymentPence": BAD_PENCE,
    },
    {
      $set: {
        "payload.answers.totalAgreementPaymentPence": FIXED_PENCE,
        "payload.answers.payments.agreement.0.agreementTotalPence": FIXED_PENCE,
      },
    },
  );

  await db.collection("inbox").updateOne(
    {
      source: "GAS",
      "event.type": CASE_CREATE_EVENT_TYPE,
      "event.data.caseRef": CASE_REF,
      "event.data.workflowCode": WORKFLOW_CODE,
      "event.data.payload.answers.totalAgreementPaymentPence": BAD_PENCE,
    },
    {
      $set: {
        "event.data.payload.answers.totalAgreementPaymentPence": FIXED_PENCE,
        "event.data.payload.answers.payments.agreement.0.agreementTotalPence":
          FIXED_PENCE,
      },
    },
  );
};
