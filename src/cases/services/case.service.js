import Boom from "@hapi/boom";
import { caseRepository } from "../repositories/case.repository.js";
import { workflowRepository } from "../repositories/workflow.repository.js";

const createCase = (workflow, caseEvent) => ({
  caseRef: caseEvent.clientRef,
  workflowCode: workflow.code,
  status: "NEW",
  dateReceived: new Date().toISOString(),
  targetDate: null,
  priority: "LOW",
  assignedUser: null,
  payload: structuredClone(caseEvent),
  currentStage: workflow.stages[0].id,
  stages: workflow.stages.map((stage) => ({
    id: stage.id,
    taskGroups: stage.taskGroups.map((taskGroup) => ({
      id: taskGroup.id,
      tasks: taskGroup.tasks.map((task) => ({
        id: task.id,
        isComplete: false,
      })),
    })),
  })),
});

export const caseService = {
  handleCreateCaseEvent: async (caseEvent) => {
    const workflow = await workflowRepository.getWorkflow(caseEvent.code);
    if (!workflow) {
      throw Boom.badRequest(`Workflow ${caseEvent.code} not found`);
    }
    const newCase = createCase(workflow, caseEvent);
    return caseRepository.createCase(newCase);
  },
  createCase: async (caseData) => {
    return caseRepository.createCase(caseData);
  },
  getCase: async (caseId) => {
    return caseRepository.getCase(caseId);
  },
  updateCaseStage: async (caseId, nextStage) => {
    return await caseRepository.updateStage(caseId, nextStage);
  },
};
