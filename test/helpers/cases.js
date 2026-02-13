import { findById } from "../../src/cases/repositories/case.repository.js";
import { wreck } from "./wreck.js";

export const createCase = async (cases, payload = {}) => {
  const kase = {
    workflowCode: "frps-private-beta",
    caseRef: "APPLICATION-REF-1",
    currentPhase: "DEFAULT",
    currentStage: "APPLICATION_RECEIPT",
    currentStatus: "AWAITING_REVIEW",
    createdAt: new Date("2025-03-27T11:34:52.000Z"),
    payload: {
      clientRef: "APPLICATION-REF-1",
      code: "frps-private-beta",
      createdAt: "2025-03-27T10:34:52.000Z",
      submittedAt: "2025-03-28T11:30:52.000Z",
      identifiers: {
        sbi: "SBI001",
        frn: "FIRM0001",
        crn: "CUST0001",
        defraId: "DEFRA0001",
      },
      answers: {
        scheme: "SFI",
        year: 2025,
        hasCheckedLandIsUpToDate: true,
        actionApplications: [
          {
            parcelId: "9238",
            sheetId: "SX0679",
            code: "CSAM1",
            appliedFor: {
              unit: "ha",
              quantity: 20.23,
            },
          },
        ],
      },
    },
    timeline: [],
    phases: [
      {
        code: "DEFAULT",
        stages: [
          {
            code: "APPLICATION_RECEIPT",
            taskGroups: [
              {
                code: "APPLICATION_RECEIPT_TASKS",
                tasks: [
                  {
                    code: "SIMPLE_REVIEW",
                    status: "PENDING",
                    completed: false,
                  },
                ],
              },
            ],
          },
          {
            code: "CONTRACT",
            taskGroups: [],
          },
        ],
      },
    ],
    assignedUser: null,
    ...payload,
  };

  await cases.insertOne(kase);

  return kase;
};

export const findCaseById = async (caseId) => {
  return findById(caseId.toString());
};

export const assignUserToCase = async (caseId, assignedUserId) => {
  const response = await wreck.patch(`/cases/${caseId}/assigned-user`, {
    payload: {
      assignedUserId,
    },
  });

  return response;
};

export const completeTask = async ({
  caseId,
  taskGroupCode,
  taskCode,
  comment = null,
}) => {
  const response = await wreck.patch(
    `/cases/${caseId}/task-groups/${taskGroupCode}/tasks/${taskCode}/status`,
    {
      payload: {
        status: "COMPLETE",
        completed: true,
        comment,
      },
    },
  );

  return response;
};
