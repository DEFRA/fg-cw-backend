import { caseRepository } from "../repository/case.repository.js";
import { workflowRepository } from "../repository/workflow.repository.js";
import Boom from "@hapi/boom";

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
        isComplete: false
      }))
    }))
  }))
});

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
  },
  areMandatoryTasksComplete: async (caseId, db) => {
    const tasks = await db.task.findMany({
      where: { caseId, isMandatory: true }
    });
    return tasks.every((task) => task.status === "COMPLETED");
  },

  updateCaseStage: async (caseId, nextStage, db) => {
    return await db.case.update({
      where: { id: caseId },
      data: { currentStage: nextStage }
    });
  }
};
