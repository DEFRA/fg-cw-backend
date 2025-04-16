import { caseRepository } from "../repository/case.repository.js";
import { workflowRepository } from "../repository/workflow.repository.js";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import Boom from "@hapi/boom";

function validateCaseEvent(caseEvent, workflow) {
  const ajv = new Ajv({
    strict: true,
    allErrors: true,
    removeAdditional: "all",
    useDefaults: true
  });
  addFormats(ajv);
  const caseEventCopy = structuredClone(caseEvent);
  const valid = ajv.validate(workflow.payloadSchema, caseEventCopy);
  if (!valid) {
    throw Boom.badRequest(
      `Case event with code "${caseEvent.code}" has invalid answers: ${ajv.errorsText()}`
    );
  }
}

function createCase(workflow, caseEvent) {
  const newCase = structuredClone(workflow);
  delete newCase.description;
  delete newCase.payloadSchema;
  newCase.payload = structuredClone(caseEvent);
  newCase.taskSections = newCase.taskSections ?? [];
  newCase.taskSections.forEach((taskSection) => {
    taskSection.taskGroups = taskSection.taskGroups ?? [];
    taskSection.taskGroups.forEach((taskGroup) => {
      taskGroup.status = "NOT STARTED";
      taskGroup.tasks.forEach((task) => {
        task.value = null;
      });
    });
  });
  newCase.caseRef = caseEvent.clientRef;
  newCase.id = caseEvent.id;
  newCase.caseName = caseEvent.caseName;
  newCase.businessName = caseEvent.businessName;
  newCase.status = "NEW";
  newCase.dateReceived = new Date();
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
    if (workflow.payloadSchema) {
      validateCaseEvent(caseEvent, workflow);
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
