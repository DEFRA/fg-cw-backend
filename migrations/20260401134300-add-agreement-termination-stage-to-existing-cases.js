const WORKFLOW_CODE = "frps-private-beta";
const PHASE_CODE = "POST_AGREEMENT_MONITORING";
const STAGE_CODE = "AGREEMENT_TERMINATION";

export const up = async (db) => {
  await db.collection("cases").updateMany(
    {
      workflowCode: WORKFLOW_CODE,
      phases: {
        $elemMatch: {
          code: PHASE_CODE,
          stages: {
            $not: {
              $elemMatch: {
                code: STAGE_CODE,
              },
            },
          },
        },
      },
    },
    {
      $push: {
        "phases.$[phase].stages": agreementTerminationStage,
      },
    },
    {
      arrayFilters: [{ "phase.code": PHASE_CODE }],
    },
  );
};

const agreementTerminationStage = {
  code: STAGE_CODE,
  outcome: null,
  taskGroups: [
    {
      code: "TERMINATION_PREPARATION_TASKS",
      tasks: [
        {
          code: "CHECK_PAYMENT_RECOVERY",
          status: null,
          completed: false,
          commentRefs: [],
          updatedAt: null,
          updatedBy: null,
        },
        {
          code: "NOTIFY_CUSTOMER",
          status: null,
          completed: false,
          commentRefs: [],
          updatedAt: null,
          updatedBy: null,
        },
      ],
    },
  ],
};
