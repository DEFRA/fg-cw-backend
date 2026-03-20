export const up = async (db) => {
  const query = { code: "frps-private-beta" };

  // Add pageFragments template group with AGREEMENT_TERMINATED template
  await db.collection("workflows").updateOne(query, {
    $set: {
      "templates.pageFragments": {
        AGREEMENT_TERMINATED: {
          content: [
            {
              component: "heading",
              text: "Agreement terminated",
              level: 2,
              classes: "govuk-heading-l",
            },
            {
              component: "paragraph",
              text: "This agreement has been terminated. No further actions are available.",
              classes: "govuk-body",
            },
          ],
        },
      },
    },
  });

  // Update AGREEMENT_ACCEPTED status and add new statuses
  const monitoringStatuses = [
    {
      code: "AGREEMENT_ACCEPTED",
      name: "Agreement accepted",
      theme: "SUCCESS",
      description: "Agreement is active and being monitored",
      interactive: true,
      transitions: [
        {
          targetPosition:
            "POST_AGREEMENT_MONITORING:MONITORING:TERMINATION_REQUESTED",
          checkTasks: false,
          action: {
            code: "TERMINATE_AGREEMENT",
            name: "Terminate agreement",
            checkTasks: false,
            comment: {
              label: "Explain this decision",
              helpText:
                "You must include a reason for terminating the agreement.",
              mandatory: true,
            },
            confirm: {
              details: [
                {
                  component: "heading",
                  text: "Are you sure you want to terminate this agreement?",
                  level: 2,
                  classes: "govuk-heading-l govuk-!-margin-bottom-3",
                },
                {
                  component: "paragraph",
                  text: "Terminating this agreement will:",
                  classes: "govuk-body",
                },
                {
                  component: "unordered-list",
                  classes:
                    "govuk-list govuk-list--bullet govuk-!-margin-bottom-6",
                  items: [
                    {
                      component: "text",
                      text: "end the agreement permanently",
                    },
                    {
                      component: "text",
                      text: "trigger reclaim of any payments made",
                    },
                  ],
                },
              ],
              yes: {
                component: "container",
                items: [
                  {
                    component: "text",
                    text: "Yes, terminate this agreement",
                  },
                  {
                    component: "paragraph",
                    text: "This action cannot be undone.",
                    classes: "govuk-hint",
                  },
                ],
              },
              no: "No, do not terminate this agreement",
            },
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
      transitions: [
        {
          targetPosition:
            "POST_AGREEMENT_MONITORING:MONITORING:AGREEMENT_TERMINATED",
          checkTasks: false,
          action: null,
        },
      ],
    },
    {
      code: "AGREEMENT_TERMINATED",
      name: "Agreement terminated",
      theme: "WARN",
      description: "The agreement has been terminated",
      interactive: false,
      transitions: [],
    },
  ];

  // Update the MONITORING stage with new statuses and beforeContent
  await db.collection("workflows").updateOne(query, {
    $set: {
      "phases.1.stages.0.statuses": monitoringStatuses,
      "phases.1.stages.0.beforeContent": [
        {
          renderIf: "$.position.statusCode = 'AGREEMENT_TERMINATED'",
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
      ],
    },
  });
};
