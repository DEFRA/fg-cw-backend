export const up = async (db) => {
  const statuses = [
    [
      {
        code: "APPLICATION_RECEIVED",
        name: "Application Received",
        theme: "NEUTRAL",
        description: "Application received and pending review",
        interactive: false,
        transitions: [
          {
            targetPosition: "PRE_AWARD:REVIEW_APPLICATION:IN_REVIEW",
            checkTasks: true,
            action: {
              code: "START_REVIEW",
              name: "Start",
              checkTasks: false,
              comment: null,
            },
          },
        ],
      },
      {
        code: "IN_REVIEW",
        name: "In Review",
        theme: "INFO",
        description: "Application is being reviewed",
        interactive: true,
        transitions: [
          {
            targetPosition: "PRE_AWARD:REVIEW_APPLICATION:AGREEMENT_GENERATING",
            checkTasks: true,
            action: {
              code: "APPROVE_APPLICATION",
              name: "Approve",
              checkTasks: true,
              comment: {
                label: "Explain this decision",
                helpText:
                  "You must include an explanation for auditing purposes.",
                mandatory: true,
              },
            },
          },
          {
            targetPosition: "PRE_AWARD:REVIEW_APPLICATION:APPLICATION_REJECTED",
            checkTasks: true,
            action: {
              code: "REJECT_APPLICATION",
              name: "Reject",
              checkTasks: false,
              comment: {
                label: "Explain this decision",
                helpText:
                  "You must include an explanation for auditing purposes.",
                mandatory: true,
              },
            },
          },
          {
            targetPosition: "PRE_AWARD:REVIEW_APPLICATION:ON_HOLD",
            checkTasks: true,
            action: {
              code: "PUT_ON_HOLD",
              name: "Put on Hold",
              checkTasks: false,
              comment: {
                label: "Explain this decision",
                helpText:
                  "You must include an explanation for auditing purposes.",
                mandatory: true,
              },
            },
          },
          {
            targetPosition: "PRE_AWARD:REVIEW_APPLICATION:WITHDRAWAL_REQUESTED",
            checkTasks: false,
            action: {
              code: "WITHDRAW_APPLICATION",
              name: "Withdraw",
              checkTasks: false,
              comment: {
                label: "Explain this decision",
                helpText:
                  "You must include an explanation for auditing purposes.",
                mandatory: true,
              },
            },
          },
        ],
      },
      {
        code: "AGREEMENT_GENERATING",
        name: "Agreement Generating",
        theme: "NEUTRAL",
        description:
          "Application has been approved and agreement is being generated",
        interactive: true,
        transitions: [
          {
            targetPosition: "PRE_AWARD:REVIEW_OFFER:AGREEMENT_DRAFTED",
            checkTasks: true,
            action: null,
          },
          {
            targetPosition: "PRE_AWARD:REVIEW_APPLICATION:WITHDRAWAL_REQUESTED",
            checkTasks: false,
            action: {
              code: "WITHDRAW_APPLICATION",
              name: "Withdraw",
              checkTasks: false,
              comment: {
                label: "Explain this decision",
                helpText:
                  "You must include an explanation for auditing purposes.",
                mandatory: true,
              },
            },
          },
        ],
      },
      {
        code: "APPLICATION_REJECTED",
        name: "Rejected",
        theme: "ERROR",
        description: "Application has been rejected",
        interactive: false,
        transitions: [
          {
            targetPosition: "PRE_AWARD:REVIEW_APPLICATION:IN_REVIEW",
            checkTasks: true,
            action: {
              code: "REINSTATE_APPLICATION",
              name: "Reinstate Application",
              checkTasks: false,
              comment: {
                label: "Explain this decision",
                helpText:
                  "You must include an explanation for auditing purposes.",
                mandatory: true,
              },
            },
          },
        ],
      },
      {
        code: "ON_HOLD",
        name: "On Hold",
        theme: "NOTICE",
        description: "Application is on hold pending more information",
        interactive: true,
        transitions: [
          {
            targetPosition: "PRE_AWARD:REVIEW_APPLICATION:IN_REVIEW",
            checkTasks: true,
            action: {
              code: "RESUME",
              name: "Resume",
              checkTasks: false,
              comment: {
                label: "Explain this decision",
                helpText:
                  "You must include an explanation for auditing purposes.",
                mandatory: true,
              },
            },
          },
        ],
      },
      {
        code: "WITHDRAWAL_REQUESTED",
        name: "Withdrawal Requested",
        description: "Application withdrawal has been requested",
        interactive: false,
        transitions: [
          {
            targetPosition:
              "PRE_AWARD:REVIEW_APPLICATION:APPLICATION_WITHDRAWN",
            checkTasks: false,
            action: null,
          },
        ],
      },
      {
        code: "APPLICATION_WITHDRAWN",
        name: "Withdrawn",
        theme: "WARN",
        description: "Application has been withdrawn",
        interactive: false,
        transitions: [],
      },
    ],
    [
      {
        code: "AGREEMENT_DRAFTED",
        name: "Agreement drafted",
        theme: "INFO",
        description: "Offer is under review",
        interactive: true,
        transitions: [
          {
            targetPosition:
              "PRE_AWARD:CUSTOMER_AGREEMENT_REVIEW:AGREEMENT_OFFERED",
            checkTasks: true,
            action: {
              code: "AGREEMENT_SENT",
              name: "Agreement sent",
              checkTasks: true,
              comment: null,
            },
          },
          {
            targetPosition: "PRE_AWARD:REVIEW_OFFER:APPLICATION_REJECTED",
            checkTasks: true,
            action: {
              code: "REJECT_APPLICATION",
              name: "Reject",
              checkTasks: false,
              comment: {
                label: "Explain this decision",
                helpText:
                  "You must include an explanation for auditing purposes.",
                mandatory: true,
              },
            },
          },
          {
            targetPosition: "PRE_AWARD:REVIEW_OFFER:WITHDRAWAL_REQUESTED",
            checkTasks: false,
            action: {
              code: "WITHDRAW_APPLICATION",
              name: "Withdraw",
              checkTasks: false,
              comment: {
                label: "Explain this decision",
                helpText:
                  "You must include an explanation for auditing purposes.",
                mandatory: true,
              },
            },
          },
        ],
      },
      {
        code: "WITHDRAWAL_REQUESTED",
        name: "Withdrawal Requested",
        description: "Application withdrawal has been requested",
        interactive: false,
        transitions: [
          {
            targetPosition: "PRE_AWARD:REVIEW_OFFER:APPLICATION_WITHDRAWN",
            checkTasks: false,
            action: null,
          },
        ],
      },
      {
        code: "APPLICATION_WITHDRAWN",
        name: "Withdrawn",
        theme: "WARN",
        description: "Application has been withdrawn",
        interactive: false,
        transitions: [],
      },
      {
        code: "APPLICATION_REJECTED",
        name: "Rejected",
        theme: "ERROR",
        description: "Application has been rejected",
        interactive: false,
        transitions: [
          {
            targetPosition: "PRE_AWARD:REVIEW_OFFER:AGREEMENT_DRAFTED",
            checkTasks: true,
            action: {
              code: "REINSTATE_APPLICATION",
              name: "Reinstate Application",
              checkTasks: false,
              comment: {
                label: "Explain this decision",
                helpText:
                  "You must include an explanation for auditing purposes.",
                mandatory: false,
              },
            },
          },
        ],
      },
    ],
    [
      {
        code: "AGREEMENT_OFFERED",
        name: "Agreement offered",
        theme: "INFO",
        description: "Offer has been made to the applicant",
        interactive: true,
        transitions: [
          {
            targetPosition:
              "POST_AGREEMENT_MONITORING:MONITORING:AGREEMENT_ACCEPTED",
            checkTasks: true,
            action: null,
          },
          {
            targetPosition:
              "PRE_AWARD:CUSTOMER_AGREEMENT_REVIEW:WITHDRAWAL_REQUESTED",
            checkTasks: false,
            action: {
              code: "WITHDRAW_APPLICATION",
              name: "Withdraw",
              checkTasks: false,
              comment: {
                label: "Explain this decision",
                helpText:
                  "You must include an explanation for auditing purposes.",
                mandatory: true,
              },
            },
          },
        ],
      },
      {
        code: "WITHDRAWAL_REQUESTED",
        name: "Withdrawal Requested",
        description: "Application withdrawal has been requested",
        interactive: false,
        transitions: [
          {
            targetPosition:
              "PRE_AWARD:CUSTOMER_AGREEMENT_REVIEW:APPLICATION_WITHDRAWN",
            checkTasks: false,
            action: null,
          },
        ],
      },
      {
        code: "APPLICATION_WITHDRAWN",
        name: "Withdrawn",
        theme: "WARN",
        description: "Application has been withdrawn",
        interactive: false,
        transitions: [],
      },
    ],
  ];

  await db.collection("workflows").updateOne(
    { code: "frps-private-beta" },
    {
      $set: {
        "phases.0.stages.0.statuses": statuses[0],
        "phases.0.stages.1.statuses": statuses[1],
        "phases.0.stages.2.statuses": statuses[2],
      },
    },
  );
};
