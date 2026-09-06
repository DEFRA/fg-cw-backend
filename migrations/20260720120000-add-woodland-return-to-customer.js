const returnToCustomerConfirmation = {
  details: [
    {
      component: "heading",
      text: "Are you sure you want to return the application to the customer?",
      level: 1,
      classes: "govuk-heading-l",
    },
    {
      component: "paragraph",
      text: "If you return the application the customer will be able to edit it and then resubmit a new application.",
    },
  ],
  yes: {
    component: "container",
    items: [
      {
        component: "text",
        text: "Yes, return the application to customer",
      },
    ],
  },
  no: {
    component: "container",
    items: [
      {
        component: "text",
        text: "No, go back to Application received",
      },
    ],
  },
};

const returnToCustomerTransition = {
  targetPosition:
    "PHASE_PRE_AWARD:STAGE_APPLICATION_AMENDMENT:STATUS_RETURNED_TO_CUSTOMER",
  checkTasks: false,
  action: {
    code: "ACTION_RETURN_TO_CUSTOMER",
    name: "Return to customer",
    checkTasks: false,
    comment: {
      label: {
        text: "Reason for return",
        classes: "govuk-visually-hidden",
      },
      helpText:
        "What is the reason for returning this application to the customer?",
      mandatory: true,
    },
    confirm: returnToCustomerConfirmation,
  },
};

const applicationAmendmentStage = {
  name: "Returned to customer",
  code: "STAGE_APPLICATION_AMENDMENT",
  description:
    "The application has been sent back to the client for modification",
  statuses: [
    {
      code: "STATUS_RETURNED_TO_CUSTOMER",
      name: "Returned to customer",
      theme: "WARN",
      description:
        "The application has been sent back to the client for modification",
      interactive: false,
      closes: true,
      transitions: [],
    },
  ],
  taskGroups: [],
  beforeContent: [
    {
      renderIf: "jsonata:$.position.statusCode = 'STATUS_RETURNED_TO_CUSTOMER'",
      content: [
        {
          component: "heading",
          text: "Application returned to customer",
          level: 3,
        },
        {
          component: "paragraph",
          text: "Application $.caseRef has been returned to customer.",
        },
        {
          component: "paragraph",
          text: "You need to email the customer to notify them and provide a link to amend their returned application.",
        },
      ],
    },
  ],
};

const findReviewingApplicationStage = (workflow) => {
  const preAwardPhase = workflow.phases?.find(
    (p) => p.code === "PHASE_PRE_AWARD",
  );
  return preAwardPhase?.stages?.find(
    (s) => s.code === "STAGE_REVIEWING_APPLICATION",
  );
};

const findStatus = (stage, statusCode) =>
  stage?.statuses?.find((s) => s.code === statusCode);

export const up = async (db) => {
  const workflow = await db
    .collection("workflows")
    .findOne({ code: "woodland" });

  if (!workflow) {
    return;
  }

  const reviewingStage = findReviewingApplicationStage(workflow);
  if (!reviewingStage) {
    return;
  }

  const inReviewStatus = findStatus(
    reviewingStage,
    "STATUS_APPLICATION_IN_REVIEW",
  );

  if (inReviewStatus) {
    const approveTransition = inReviewStatus.transitions?.find(
      (t) => t.action?.code === "ACTION_APPROVE_APPLICATION",
    );

    if (approveTransition) {
      approveTransition.action.name = "Generate agreement";
      approveTransition.action.comment = null;
    }

    inReviewStatus.transitions.push(returnToCustomerTransition);
  }

  const inReviewBeforeContent = reviewingStage.beforeContent?.find(
    (bc) =>
      bc.renderIf ===
      "jsonata:$.position.statusCode = 'STATUS_APPLICATION_IN_REVIEW'",
  );

  if (inReviewBeforeContent) {
    inReviewBeforeContent.content = [
      {
        component: "heading",
        level: 3,
        text: "Application received",
      },
      {
        component: "paragraph",
        text: "Select 'Generate agreement' if you are ready to continue. If the customer needs to make amendments select 'Return to customer'.",
      },
    ];
  }

  const preAwardPhase = workflow.phases.find(
    (p) => p.code === "PHASE_PRE_AWARD",
  );

  preAwardPhase.stages.push(applicationAmendmentStage);

  await db.collection("workflows").replaceOne({ _id: workflow._id }, workflow);
};
