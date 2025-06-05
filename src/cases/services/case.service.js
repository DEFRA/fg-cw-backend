import Boom from "@hapi/boom";
import { createCase } from "../repositories/create-case.repository.js";
import { findCase } from "../repositories/find-case.repository.js";
import { updateStage } from "../repositories/update-stage.repository.js";
import { workflowRepository } from "../repositories/workflow.repository.js";

const mergeCaseWithWorkflow = (workflow, caseEvent) => ({
  caseRef: caseEvent.clientRef,
  workflowCode: workflow.code,
  status: "NEW",
  dateReceived: new Date().toISOString(),
  priority: "LOW",
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
    const newCase = mergeCaseWithWorkflow(workflow, caseEvent);
    return createCase(newCase);
  },
  createCase: async (caseData) => {
    return createCase(caseData);
  },
  getCase: async (caseId) => {
    return findCase(caseId);
  },
  updateCaseStage: async (caseId, nextStage) => {
    return await updateStage(caseId, nextStage);
  },
};
