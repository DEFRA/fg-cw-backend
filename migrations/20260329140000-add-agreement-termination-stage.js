const terminateAgreementConfirmation = {
  details: [
    {
      component: "heading",
      text: "Are you sure you want to terminate this agreement?",
      level: 1,
      classes: "govuk-heading-l",
    },
    {
      component: "paragraph",
      text: "Terminating this agreement will:",
    },
    {
      component: "unordered-list",
      classes: "govuk-list govuk-list--bullet",
      items: [
        {
          component: "text",
          text: "stop all future payments to the agreement holder",
        },
        {
          component: "text",
          text: "end all actions and standards the agreement holder has agreed to deliver",
        },
        {
          component: "text",
          text: "close the agreement in the system so no further changes can be made",
        },
      ],
    },
  ],
  label: "Terminate the agreement",
  yes: {
    component: "text",
    text: "Yes",
  },
  no: {
    component: "text",
    text: "No",
  },
};

const terminateAgreementComment = {
  label: "Explain this decision",
  helpText: "You must include an explanation for auditing purposes.",
  mandatory: true,
};

const initiateTerminationComment = {
  helpText: "You must include an explanation for auditing purposes.",
  mandatory: true,
};

const taskComment = {
  label: "Explain this outcome",
  helpText: "You must include an explanation for auditing purposes.",
  mandatory: true,
};

const agreementTerminatedPageFragment = {
  content: [
    {
      component: "heading",
      text: "The agreement has been terminated",
      level: 2,
      classes: "govuk-heading-m govuk-!-margin-top-6 govuk-!-margin-bottom-4",
    },
    {
      component: "paragraph",
      text: "The agreement has now been closed.",
    },
    {
      component: "paragraph",
      text: "What this means:",
    },
    {
      component: "unordered-list",
      classes: "govuk-list govuk-list--bullet",
      items: [
        {
          component: "text",
          text: "All future payments have stopped for the agreement holder.",
        },
        {
          component: "text",
          text: "All actions and standards in the agreement have ended.",
        },
        {
          component: "text",
          text: "The agreement is locked and can't be updated or reopened.",
        },
      ],
    },
  ],
};

const monitoringBeforeContent = [
  {
    renderIf:
      "jsonata:$.request.params.tabId = 'tasks' and $.position.statusCode = 'AGREEMENT_ACCEPTED'",
    content: [
      {
        component: "heading",
        text: "Post-agreement monitoring and compliance tasks",
        level: 2,
        classes: "govuk-heading-m",
      },
      {
        component: "paragraph",
        text: "There are no tasks to complete.",
      },
      {
        component: "heading",
        text: "Terminating this agreement",
        level: 2,
        classes: "govuk-heading-s",
      },
      {
        component: "paragraph",
        text: "You may want to terminate this agreement if:",
      },
      {
        component: "unordered-list",
        classes: "govuk-list govuk-list--bullet",
        items: [
          {
            component: "text",
            text: "the customer needs to change their agreement",
          },
          {
            component: "text",
            text: "the customer is in breach of the agreement",
          },
        ],
      },
      {
        component: "heading",
        text: "Reason for termination",
        level: 2,
        classes: "govuk-heading-s govuk-!-font-weight-bold",
      },
    ],
  },
];

const agreementAcceptedStatus = {
  code: "AGREEMENT_ACCEPTED",
  name: "Agreement accepted",
  theme: "SUCCESS",
  description: "Agreement is active and being monitored",
  interactive: true,
  closes: false,
  transitions: [
    {
      targetPosition:
        "POST_AGREEMENT_MONITORING:AGREEMENT_TERMINATION:PRE_TERMINATION_CHECKS",
      checkTasks: false,
      action: {
        code: "INITIATE_TERMINATION",
        name: "Terminate",
        checkTasks: false,
        confirm: null,
        comment: initiateTerminationComment,
      },
    },
  ],
};

const agreementTerminationBeforeContent = [
  {
    renderIf:
      "jsonata:$.request.params.tabId = 'tasks' and $.position.statusCode = 'AGREEMENT_TERMINATED'",
    content: [
      {
        component: "container",
        items: [
          {
            component: "template",
            templateRef: "$.templates.pageFragments",
            templateKey: "AGREEMENT_TERMINATED",
          },
        ],
      },
    ],
  },
];

const agreementTerminationStatuses = [
  {
    code: "PRE_TERMINATION_CHECKS",
    name: "Preparing to terminate",
    theme: "INFO",
    description: "Pre-termination checks are being completed",
    interactive: true,
    closes: false,
    transitions: [
      {
        targetPosition:
          "POST_AGREEMENT_MONITORING:AGREEMENT_TERMINATION:TERMINATION_REQUESTED",
        checkTasks: true,
        action: {
          code: "TERMINATE_AGREEMENT",
          name: "Terminate agreement",
          checkTasks: true,
          confirm: terminateAgreementConfirmation,
          comment: terminateAgreementComment,
        },
      },
      {
        targetPosition:
          "POST_AGREEMENT_MONITORING:MONITORING:AGREEMENT_ACCEPTED",
        checkTasks: false,
        action: {
          code: "CANCEL_TERMINATION",
          name: "End termination process",
          checkTasks: false,
          confirm: null,
          comment: null,
        },
      },
    ],
  },
  {
    code: "TERMINATION_REQUESTED",
    name: "Termination requested",
    theme: "WARN",
    description: "Termination of this agreement has been requested",
    interactive: false,
    closes: false,
    transitions: [
      {
        targetPosition:
          "POST_AGREEMENT_MONITORING:AGREEMENT_TERMINATION:AGREEMENT_TERMINATED",
        checkTasks: false,
        action: null,
      },
    ],
  },
  {
    code: "AGREEMENT_TERMINATED",
    name: "Terminated",
    theme: "ERROR",
    description: "The agreement has been terminated",
    interactive: false,
    closes: true,
    hideTaskGroups: true,
    transitions: [],
  },
];

const agreementTerminationTaskGroups = [
  {
    code: "TERMINATION_PREPARATION_TASKS",
    name: "Termination preparation tasks",
    description: "Tasks to be completed during pre-termination checks",
    tasks: [
      {
        code: "CHECK_PAYMENT_RECOVERY",
        name: "Check for payment recovery",
        description: [
          {
            component: "heading",
            text: "Check for payment recovery",
            level: 2,
            classes: "govuk-heading-l",
          },
          {
            component: "paragraph",
            text: "Check if terminating the agreement will require the recovery of payments from the agreement holder.",
          },
        ],
        mandatory: true,
        statusOptions: [
          {
            code: "CONFIRM",
            name: "Confirmed",
            theme: "NONE",
            altName: "Confirm",
            completes: true,
          },
          {
            code: "PROBLEM_FOUND",
            name: "There's a problem",
            theme: "ERROR",
            altName: "There's a problem",
            completes: false,
          },
        ],
        requiredRoles: {
          allOf: [],
          anyOf: [],
        },
        comment: taskComment,
      },
      {
        code: "NOTIFY_CUSTOMER",
        name: "Notify customer that draft agreement is ready",
        description: [
          {
            component: "heading",
            text: "Notify customer that draft agreement is ready",
            level: 2,
            classes: "govuk-heading-l",
          },
          {
            component: "paragraph",
            text: "Tell the customer that their agreement is to be terminated in accordance with the terms of their agreement.",
          },
        ],
        mandatory: true,
        statusOptions: [
          {
            code: "CONFIRM",
            name: "Confirmed",
            theme: "NONE",
            altName: "Confirm",
            completes: true,
          },
          {
            code: "PROBLEM_FOUND",
            name: "There's a problem",
            theme: "ERROR",
            altName: "There's a problem",
            completes: false,
          },
        ],
        requiredRoles: {
          allOf: [],
          anyOf: [],
        },
        comment: taskComment,
      },
    ],
  },
];

const agreementTerminationStage = {
  code: "AGREEMENT_TERMINATION",
  name: "Tasks",
  description: "Stage to control the workflow for the termination process",
  beforeContent: agreementTerminationBeforeContent,
  statuses: agreementTerminationStatuses,
  taskGroups: agreementTerminationTaskGroups,
};

export const up = async (db) => {
  const workflowQuery = { code: "frps-private-beta" };

  // First update: Add pageFragment and update MONITORING stage
  await db.collection("workflows").updateOne(workflowQuery, {
    $set: {
      "templates.pageFragments.AGREEMENT_TERMINATED":
        agreementTerminatedPageFragment,
      "phases.1.stages.0.name": "Tasks",
      "phases.1.stages.0.statuses": [agreementAcceptedStatus],
      "phases.1.stages.0.beforeContent": monitoringBeforeContent,
      "phases.1.stages.0.taskGroups": [],
    },
  });

  // Second update: Add AGREEMENT_TERMINATION stage
  await db.collection("workflows").updateOne(workflowQuery, {
    $push: {
      "phases.1.stages": agreementTerminationStage,
    },
  });
};
