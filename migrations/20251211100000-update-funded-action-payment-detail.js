export const up = async (db) => {
  const newPaymentSummary = {
    component: "summary-list",
    rows: [
      {
        label: "Agreement total payment",
        text: [
          {
            component: "container",
            items: [
              {
                text: "jsonata:'£' & $formatNumber(($.payload.answers.totalAnnualPaymentPence * $.payload.answers.payments.parcel[0].actions[0].durationYears) / 100, '#,##0.00')",
              },
              {
                text: "jsonata:' over ' & $string($.payload.answers.payments.parcel[0].actions[0].durationYears) & ' years'",
              },
            ],
          },
        ],
      },
      {
        label: "Total yearly payment",
        text: "jsonata:'£' & $formatNumber($.payload.answers.totalAnnualPaymentPence / 100, '#,##0.00')",
      },
    ],
  };

  const newFundedActionPaymentDetail = {
    component: "summary-list",
    rows: [
      {
        component: "repeat",
        itemsRef:
          'jsonata:( $allActions := $.payload.answers.payments.parcel[*].actions[*]; $validActions := $allActions[$exists(paymentRates) and $exists(appliedFor.quantity)]; $agreements := $.payload.answers.payments.agreement; $codes := $distinct($validActions.code); $sorted := $sort($codes, function($l, $r) { ($exists($agreements[code=$l]) ? 1 : 0) - ($exists($agreements[code=$r]) ? 1 : 0) }); $sorted.( $currentCode := $; { "code": $currentCode, "actions": $validActions[code=$currentCode] } ) )',
        items: [
          {
            label: "@.code annual payment",
            text: [
              {
                text: "jsonata:'£' & $formatNumber($round($sum(@.actions.( appliedFor.quantity * paymentRates )) + ($exists($.payload.answers.payments.agreement[code=@.code]) ? $sum($.payload.answers.payments.agreement[code=@.code].annualPaymentPence) : 0)) / 100, '#,##0.00')",
                classes: "govuk-!-display-block",
              },
              {
                text: "jsonata:'( ' & $join(@.actions.( $string(appliedFor.quantity) & ' ' & appliedFor.unit & ' x £' & $formatNumber(paymentRates / 100, '#.00') & ' per ' & appliedFor.unit ), ', ') & ($exists($.payload.answers.payments.agreement[code=@.code]) ? ', £' & $formatNumber($.payload.answers.payments.agreement[code=@.code].annualPaymentPence / 100, '#.00') & ' per SFI agreement per year' : '') & ' )'",
                classes: "govuk-body-m",
              },
            ],
          },
        ],
      },
      {
        component: "repeat",
        itemsRef:
          "jsonata:$.payload.answers.payments.agreement[code $not in $.payload.answers.payments.parcel[*].actions[*].code]",
        items: [
          {
            label: "@.code annual payment",
            text: [
              {
                text: "jsonata:'£' & $formatNumber(@.annualPaymentPence / 100, '#,##0.00')",
                classes: "govuk-!-display-block",
              },
              {
                component: "container",
                classes: "govuk-body-m",
                items: [
                  {
                    text: "(1 ha x ",
                  },
                  {
                    text: "@.paymentRates",
                    format: "penniesToPounds",
                  },
                  {
                    text: " per ha, ",
                  },
                  {
                    text: "@.annualPaymentPence",
                    format: "penniesToPounds",
                  },
                  {
                    text: " per SFI agreement per year)",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        "pages.cases.details.tabs.case-details.content.2.items.2.content.0":
          newPaymentSummary,
        "pages.cases.details.tabs.case-details.content.2.items.2.content.2":
          newFundedActionPaymentDetail,
      },
    },
  );
};
