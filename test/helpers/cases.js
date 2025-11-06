import { CasePhase } from "../../src/cases/models/case-phase.js";
import { CaseStage } from "../../src/cases/models/case-stage.js";
import { CaseTaskGroup } from "../../src/cases/models/case-task-group.js";
import { CaseTask } from "../../src/cases/models/case-task.js";
import { Case } from "../../src/cases/models/case.js";
import { findById } from "../../src/cases/repositories/case.repository.js";
import { CaseDocument } from "../../src/cases/repositories/case/case-document.js";
import { wreck } from "./wreck.js";

export const createCase = async (cases) => {
  const caseModel = new Case(buildDefaultCaseProps());
  const caseDocument = new CaseDocument(caseModel);

  await cases.insertOne(caseDocument);

  return caseModel;
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

const buildDefaultCaseProps = () => ({
  workflowCode: "frps-private-beta",
  caseRef: "APPLICATION-REF-1",
  currentStatus: "NEW",
  currentPhase: "default",
  currentStage: "application-receipt",
  dateReceived: "2025-03-27T11:34:52.000Z",
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
  phases: [
    new CasePhase({
      code: "default",
      stages: [
        new CaseStage({
          code: "application-receipt",
          taskGroups: [
            new CaseTaskGroup({
              code: "application-receipt-tasks",
              tasks: [
                new CaseTask({
                  code: "simple-review",
                  status: null,
                  completed: false,
                }),
              ],
            }),
          ],
        }),
        new CaseStage({
          code: "contract",
          taskGroups: [],
        }),
      ],
    }),
  ],
  comments: [],
  timeline: [],
  supplementaryData: {},
  assignedUser: null,
});
