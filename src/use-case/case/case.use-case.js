import { caseRepository } from "../../repository/case.repository.js";
import { workflowRepository } from "../../repository/workflow.repository.js";
import Boom from "@hapi/boom";
import { ObjectId } from "mongodb";
import { db } from "../../common/helpers/db.js";

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

export const caseUseCase = {
  handleCreateCaseEvent: async (caseEvent) => {
    const workflow = await workflowRepository.getWorkflow(caseEvent.code);
    if (!workflow) {
      throw Boom.badRequest(`Workflow ${caseEvent.code} not found`);
    }
    const newCase = createCase(workflow, caseEvent);
    return caseRepository.createCase(newCase);
  },
  findCases: async (listQuery) => {
    return caseRepository.findCases(listQuery);
  },
  getCase: async (caseId) => {
    return caseRepository.getCase(caseId);
  },
  updateCaseStage: async (caseId, nextStage) => {
    return await db.collection("cases").updateOne(
      {
        _id: new ObjectId(caseId)
      },
      { $set: { currentStage: nextStage } }
    );
  }
};
