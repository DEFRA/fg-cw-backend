import Boom from "@hapi/boom";
import { extractListQuery } from "../../common/extract-list-query.js";
import { publishCaseStageUpdated } from "../publishers/case-event.publisher.js";
import { caseService } from "../services/case.service.js";
import { findCasesUseCase } from "../use-cases/list-cases.use-case.js";
import { updateStages } from "../use-cases/update-stages.use-case.js";

export const caseCreateController = async (request, h) => {
  return h.response(await caseService.createCase(request.payload)).code(201);
};

export const caseListController = async (request, h) => {
  const listQuery = extractListQuery(request);
  const results = await findCasesUseCase(listQuery);
  return h.response(results);
};

export const caseDetailController = async (request, h) => {
  const result = await caseService.getCase(request.params.caseId);
  if (!result) {
    return Boom.notFound(
      "Case with id: " + request.params.caseId + " not found",
    );
  }
  return h.response(result);
};

export const caseStageController = async (request, h) => {
  const { caseId } = request.params;

  const caseRecord = await caseService.getCase(caseId);
  if (!caseRecord) {
    return Boom.notFound(`Case with id: ${caseId} not found`);
  }

  const stages = caseRecord.stages;
  const previousStage = caseRecord.currentStage;

  const stage = stages.find((s) => s.id === previousStage);

  const allTasks = stage.taskGroups.map((tg) => tg.tasks.map((t) => t)).flat();

  const allTasksComplete = allTasks.every((t) => t.isComplete);

  if (!allTasksComplete) {
    throw Boom.badRequest("All tasks must be complete.");
  }

  const nextStage = stages.reduce((stageAcc, curStage, index) => {
    if (curStage.id === previousStage) {
      stageAcc = stages[index + 1];
    }
    return stageAcc;
  }, {});

  await caseService.updateCaseStage(caseId, nextStage.id);

  await publishCaseStageUpdated(caseRecord.caseRef, previousStage, nextStage);

  return h.response().code(204);
};

export const caseTaskCompleteController = async (request, h) => {
  const { caseId } = request.payload;

  const caseRecord = await caseService.getCase(caseId);
  if (!caseRecord) {
    return Boom.notFound(`Case with id: ${caseId} not found`);
  }

  const { stages, currentStage } = caseRecord;

  await updateStages({
    payload: request.payload,
    stages,
    curStageId: currentStage,
  });

  return h.response().code(204);
};
