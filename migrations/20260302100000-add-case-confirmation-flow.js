const rejectConfirmation = {
  details: [
    {
      component: "heading",
      text: "Are you sure you want to reject this application?",
      level: 2,
      classes: "govuk-!-margin-bottom-3",
    },
    {
      component: "paragraph",
      text: "Rejecting an application will:",
      classes: "govuk-body",
    },
    {
      component: "unordered-list",
      classes: "govuk-list govuk-list--bullet govuk-!-margin-bottom-6",
      items: [
        {
          component: "text",
          text: "close the application permanently",
        },
        {
          component: "text",
          text: "notify the applicant of the rejection",
        },
      ],
    },
  ],
  yes: {
    component: "container",
    items: [
      {
        component: "text",
        text: "Yes, I want to reject this application",
      },
      {
        component: "paragraph",
        text: "This action cannot be undone.",
        classes: "govuk-hint",
      },
    ],
  },
  no: "No, I do not want to reject this application",
};

const nullConfirmation = {
  details: null,
  yes: null,
  no: null,
};

export const up = async (db) => {
  const workflowQuery = { code: "pigs-might-fly" };

  // Add confirm to REJECT_APPLICATION action in IN_REVIEW status
  // Path: phases[0].stages[0].statuses[1].transitions[1].action.confirm
  await db.collection("workflows").updateOne(workflowQuery, {
    $set: {
      "phases.0.stages.0.statuses.1.transitions.1.action.confirm":
        rejectConfirmation,
    },
  });

  // Add confirm to PUT_ON_HOLD action in IN_REVIEW status
  // Path: phases[0].stages[0].statuses[1].transitions[2].action.confirm
  await db.collection("workflows").updateOne(workflowQuery, {
    $set: {
      "phases.0.stages.0.statuses.1.transitions.2.action.confirm":
        nullConfirmation,
    },
  });
};
