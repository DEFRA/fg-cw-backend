import { findById } from "../../src/cases/repositories/case.repository.js";
import { wreck } from "./wreck.js";

export const createCase = async (cases, payload = {}) => {
  const kase = {
    workflowCode: "frps-private-beta",
    caseRef: "APPLICATION-REF-1",
    status: "NEW",
    dateReceived: new Date("2025-03-27T11:34:52.000Z"),
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
    currentStage: "application-receipt",
    timeline: [],
    stages: [
      {
        code: "application-receipt",
        taskGroups: [
          {
            code: "application-receipt-tasks",
            tasks: [
              {
                code: "simple-review",
                status: "pending",
              },
            ],
          },
        ],
      },
      {
        code: "contract",
        taskGroups: [],
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
