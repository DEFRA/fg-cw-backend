const returnToCustomerConfirmation = {
  details: [
    {
      component: "heading",
      text: "Are you sure you want to return this application to the customer?",
      level: 1,
      classes: "govuk-heading-l",
    },
    {
      component: "paragraph",
      text: "Returning an application to the customer will:",
    },
    {
      component: "unordered-list",
      classes: "govuk-list govuk-list--bullet",
      items: [
        {
          component: "text",
          text: "cancel the current application",
        },
        {
          component: "text",
          text: "allow the customer to edit and submit a duplicate, draft application",
        },
      ],
    },
  ],
  yes: {
    component: "container",
    items: [
      {
        component: "text",
        text: "Yes, I want to return this application to the customer",
      },
      {
        component: "paragraph",
        text: "All review tasks will need to be started again once the returned application is submitted.",
        classes: "govuk-hint",
      },
    ],
  },
  no: {
    component: "container",
    items: [
      {
        component: "text",
        text: "No, I do not want to return this application to the customer",
      },
      {
        component: "paragraph",
        text: "Go back to reviewing the current application.",
        classes: "govuk-hint",
      },
    ],
  },
};

const returnToCustomerComment = {
  label: "Explain this decision",
  helpText: "You must include a reason for returning to customer.",
  mandatory: true,
};

const applicationAmendContent = [
  {
    component: "heading",
    text: "Application returned to customer for amending",
    level: 2,
    classes: "govuk-heading-m",
  },
  {
    component: "paragraph",
    text: "Application $.caseRef has been cancelled. However, you can still review the notes and timeline for this application.",
  },
  {
    component: "paragraph",
    text: "A new, linked application will be submitted after amendments have been made by the customer.",
  },
  {
    component: "paragraph",
    text: "All review tasks will need to be started again once the amended application is submitted.",
  },
];

const applicationAmendBeforeContent = {
  renderIf:
    "jsonata:$.request.params.tabId = 'tasks' and $.position.statusCode = 'APPLICATION_AMEND'",
  content: [
    {
      component: "container",
      items: [
        {
          component: "template",
          templateRef: "$.templates.pageFragments",
          templateKey: "APPLICATION_AMEND",
        },
      ],
    },
  ],
};

const reviewApplicationStatuses = [
  {
    code: "APPLICATION_RECEIVED",
    name: "Application Received",
    theme: "NEUTRAL",
    description: "Application received and pending review",
    interactive: false,
    closes: false,
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
    closes: false,
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
            helpText: "You must include an explanation for auditing purposes.",
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
            helpText: "You must include an explanation for auditing purposes.",
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
            helpText: "You must include an explanation for auditing purposes.",
            mandatory: true,
          },
        },
      },
      {
        targetPosition: "PRE_AWARD:REVIEW_APPLICATION:APPLICATION_AMEND",
        checkTasks: false,
        action: {
          code: "RETURN_TO_CUSTOMER",
          name: "Return to customer",
          checkTasks: false,
          confirm: returnToCustomerConfirmation,
          comment: returnToCustomerComment,
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
            helpText: "You must include an explanation for auditing purposes.",
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
    closes: false,
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
            helpText: "You must include an explanation for auditing purposes.",
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
    closes: true,
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
            helpText: "You must include an explanation for auditing purposes.",
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
    closes: false,
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
            helpText: "You must include an explanation for auditing purposes.",
            mandatory: true,
          },
        },
      },
      {
        targetPosition: "PRE_AWARD:REVIEW_APPLICATION:APPLICATION_AMEND",
        checkTasks: false,
        action: {
          code: "RETURN_TO_CUSTOMER",
          name: "Return to customer",
          checkTasks: false,
          confirm: returnToCustomerConfirmation,
          comment: returnToCustomerComment,
        },
      },
    ],
  },
  {
    code: "APPLICATION_AMEND",
    name: "Returned to customer",
    theme: "WARN",
    description: "The application has been returned to the customer",
    interactive: false,
    closes: true,
    transitions: [],
  },
  {
    code: "WITHDRAWAL_REQUESTED",
    name: "Withdrawal Requested",
    theme: "WARN",
    description: "Application withdrawal has been requested",
    interactive: false,
    closes: false,
    transitions: [
      {
        targetPosition: "PRE_AWARD:REVIEW_APPLICATION:APPLICATION_WITHDRAWN",
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
    closes: true,
    transitions: [],
  },
];

const reviewOfferStatuses = [
  {
    code: "AGREEMENT_DRAFTED",
    name: "Agreement drafted",
    theme: "INFO",
    description: "Offer is under review",
    interactive: true,
    closes: false,
    transitions: [
      {
        targetPosition: "PRE_AWARD:CUSTOMER_AGREEMENT_REVIEW:AGREEMENT_OFFERED",
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
            helpText: "You must include an explanation for auditing purposes.",
            mandatory: true,
          },
        },
      },
      {
        targetPosition: "PRE_AWARD:REVIEW_OFFER:AMENDMENT_REQUESTED",
        checkTasks: false,
        action: {
          code: "RETURN_TO_CUSTOMER",
          name: "Return to customer",
          checkTasks: false,
          confirm: returnToCustomerConfirmation,
          comment: returnToCustomerComment,
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
            helpText: "You must include an explanation for auditing purposes.",
            mandatory: true,
          },
        },
      },
    ],
  },
  {
    code: "AMENDMENT_REQUESTED",
    name: "Returned to customer",
    theme: "WARN",
    description:
      "The return of the application to the customer for amendment has been requested",
    interactive: false,
    closes: false,
    transitions: [
      {
        targetPosition: "PRE_AWARD:REVIEW_OFFER:APPLICATION_AMEND",
        checkTasks: false,
        action: null,
      },
    ],
  },
  {
    code: "APPLICATION_AMEND",
    name: "Returned to customer",
    theme: "WARN",
    description: "The application has been returned to the customer",
    interactive: false,
    closes: true,
    transitions: [],
  },
  {
    code: "WITHDRAWAL_REQUESTED",
    name: "Withdrawal Requested",
    theme: "WARN",
    description: "Application withdrawal has been requested",
    interactive: false,
    closes: false,
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
    closes: true,
    transitions: [],
  },
  {
    code: "APPLICATION_REJECTED",
    name: "Rejected",
    theme: "ERROR",
    description: "Application has been rejected",
    interactive: false,
    closes: true,
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
            helpText: "You must include an explanation for auditing purposes.",
            mandatory: false,
          },
        },
      },
    ],
  },
];

const customerAgreementReviewStatuses = [
  {
    code: "AGREEMENT_OFFERED",
    name: "Agreement offered",
    theme: "INFO",
    description: "Offer has been made to the applicant",
    interactive: true,
    closes: false,
    transitions: [
      {
        targetPosition:
          "POST_AGREEMENT_MONITORING:MONITORING:AGREEMENT_ACCEPTED",
        checkTasks: true,
        action: null,
      },
      {
        targetPosition:
          "PRE_AWARD:CUSTOMER_AGREEMENT_REVIEW:AMENDMENT_REQUESTED",
        checkTasks: false,
        action: {
          code: "RETURN_TO_CUSTOMER",
          name: "Return to customer",
          checkTasks: false,
          confirm: returnToCustomerConfirmation,
          comment: returnToCustomerComment,
        },
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
            helpText: "You must include an explanation for auditing purposes.",
            mandatory: true,
          },
        },
      },
    ],
  },
  {
    code: "AMENDMENT_REQUESTED",
    name: "Returned to customer",
    theme: "WARN",
    description:
      "The return of the application to the customer for amendment has been requested",
    interactive: false,
    closes: false,
    transitions: [
      {
        targetPosition: "PRE_AWARD:CUSTOMER_AGREEMENT_REVIEW:APPLICATION_AMEND",
        checkTasks: false,
        action: null,
      },
    ],
  },
  {
    code: "APPLICATION_AMEND",
    name: "Returned to customer",
    theme: "WARN",
    description: "The application has been returned to the customer",
    interactive: false,
    closes: true,
    transitions: [],
  },
  {
    code: "WITHDRAWAL_REQUESTED",
    name: "Withdrawal Requested",
    theme: "WARN",
    description: "Application withdrawal has been requested",
    interactive: false,
    closes: false,
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
    closes: true,
    transitions: [],
  },
];

const customerAgreementReviewBeforeContent = [
  {
    renderIf:
      "jsonata:$.request.params.tabId = 'tasks' and $.position.statusCode = 'AGREEMENT_OFFERED'",
    content: [
      {
        component: "alert",
        variant: "success",
        title: "Agreement sent",
        text: "There is nothing more you need to do.",
        showTitleAsHeading: true,
      },
      {
        component: "paragraph",
        text: "You can still withdraw the agreement until the customer has accepted or rejected.",
      },
      {
        component: "heading",
        text: "Agreement with customer for review",
        level: 3,
      },
      {
        component: "paragraph",
        text: "There are no tasks to complete.",
      },
      {
        component: "heading",
        text: "You can still withdraw this agreement",
        level: 3,
      },
      {
        component: "paragraph",
        text: "You may want to withdraw this agreement if:",
      },
      {
        component: "unordered-list",
        items: [
          {
            text: "the customer needs to update their application",
          },
          {
            text: "the customer has not responded to the agreement offer within 10 working days",
          },
          {
            text: "there is an error in the agreement",
          },
        ],
      },
    ],
  },
  applicationAmendBeforeContent,
];

export const up = async (db) => {
  const workflowQuery = { code: "frps-private-beta" };

  await db.collection("workflows").updateOne(workflowQuery, {
    $set: {
      "templates.pageFragments.APPLICATION_AMEND": {
        content: applicationAmendContent,
      },
      "phases.0.stages.0.statuses": reviewApplicationStatuses,
      "phases.0.stages.0.beforeContent": [applicationAmendBeforeContent],
      "phases.0.stages.1.statuses": reviewOfferStatuses,
      "phases.0.stages.1.beforeContent": [applicationAmendBeforeContent],
      "phases.0.stages.2.statuses": customerAgreementReviewStatuses,
      "phases.0.stages.2.beforeContent": customerAgreementReviewBeforeContent,
    },
  });
};
