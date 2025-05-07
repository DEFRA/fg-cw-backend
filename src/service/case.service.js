import { caseRepository } from "../repository/case.repository.js";
import { workflowRepository } from "../repository/workflow.repository.js";
import Boom from "@hapi/boom";

function createCase(workflow, caseEvent) {
  const newCase = structuredClone(workflow);
  delete newCase["_id"];
  newCase.payload = structuredClone(caseEvent);
  newCase.workflowCode = workflow.code;
  delete newCase.code;
  delete newCase.payloadDefinition;
  newCase.caseRef = caseEvent.clientRef;
  newCase.status = "NEW";
  newCase.dateReceived = new Date().toISOString();
  newCase.targetDate = null;
  newCase.priority = "LOW";
  newCase.assignedUser = null;
  return newCase;
}

export const caseService = {
  handleCreateCaseEvent: async (caseEvent, db) => {
    const workflow = await workflowRepository.getWorkflow(caseEvent.code, db);
    if (!workflow) {
      throw Boom.badRequest(`Workflow ${caseEvent.code} not found`);
    }
    const newCase = createCase(workflow, caseEvent);
    return caseRepository.createCase(newCase, db);
  },
  createCase: async (caseData, db) => {
    return caseRepository.createCase(caseData, db);
  },
  findCases: async (listQuery, db) => {
    return caseRepository.findCases(listQuery, db);
  },
  getCase: async (caseId, db) => {
    return caseRepository.getCase(caseId, db);
  }
};
