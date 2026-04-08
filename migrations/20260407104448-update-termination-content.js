import { withTransaction } from "../src/common/with-transaction.js";

const taskComment = {
  label: "Explain this outcome",
  helpText: "You must include an explanation for auditing purposes.",
  mandatory: true,
};

const checksComment = {
  label: "Explain what checks have been completed",
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
          text: "Any payment recovery actions will have been initiated",
        },
        {
          component: "text",
          text: "The agreement is locked and can't be updated or reopened.",
        },
      ],
    },
  ],
};

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
          text: "trigger payment recovery actions",
        },
        {
          component: "text",
          text: "close the agreement in the system so no further changes can be made.",
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
            text: "the agreement holder has informed us in writing to terminate their agreement",
          },
          {
            component: "text",
            text: "the agreement holder is in breach of the agreement",
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
            comment: checksComment,
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
        name: "Notify Agreement Holder of agreement termination",
        description: [
          {
            component: "heading",
            text: "Notify Agreement Holder of agreement termination",
            level: 2,
            classes: "govuk-heading-l",
          },
          {
            component: "paragraph",
            text: "Tell the agreement holder that their agreement is to be terminated in accordance with the terms and conditions of their agreement. Ensure the following is completed:",
          },
          {
            component: "unordered-list",
            classes: "govuk-list govuk-list--bullet",
            items: [
              {
                component: "text",
                text: "Draft the termination notification letter using the <Early Closure Template>",
              },
              {
                component: "text",
                text: "Obtain approval for the termination notification letter",
              },
              {
                component: "text",
                text: "Send the termination notification to the agreement holder",
              },
            ],
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

export const up = async (db) => {
  await withTransaction(async (session) => {
    await db.collection("workflows").updateOne(
      { code: "frps-private-beta" },
      {
        $set: {
          "phases.1.stages.0.beforeContent": monitoringBeforeContent,
          "phases.1.stages.1.taskGroups": agreementTerminationTaskGroups,
          "phases.1.stages.1.statuses.0.transitions.0.action.confirm":
            terminateAgreementConfirmation,
        },
      },
      { session },
    );

    await db.collection("workflows").updateOne(
      { code: "frps-private-beta" },
      {
        $set: {
          "templates.pageFragments.AGREEMENT_TERMINATED":
            agreementTerminatedPageFragment,
          "phases.1.stages.0.beforeContent": monitoringBeforeContent,
        },
      },
      { session },
    );
  });
};
