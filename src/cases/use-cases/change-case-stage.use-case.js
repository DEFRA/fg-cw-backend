import Boom from "@hapi/boom";
import { publishCaseStageUpdated } from "../publishers/case-event.publisher.js";
import { updateStage } from "../repositories/case.repository.js";
import { findCaseByIdUseCase } from "./find-case-by-id.use-case.js";

export const areTasksComplete = (kase) => {
  const stages = kase.stages;
  const previousStage = kase.currentStage;
  const stage = stages.find((s) => s.id === previousStage);
  const allTasks = stage.taskGroups.map((tg) => tg.tasks.map((t) => t)).flat();
  return allTasks.every((t) => t.status === "complete");
};

export const changeCaseStageUseCase = async (caseId) => {
  const kase = await findCaseByIdUseCase(caseId);

  const allTasksComplete = areTasksComplete(kase);

  if (!allTasksComplete) {
    throw Boom.badRequest("All tasks must be complete.");
  }

  const nextStage = kase.stages.reduce((stageAcc, curStage, index) => {
    if (curStage.id === kase.currentStage) {
      stageAcc = kase.stages[index + 1];
    }
    return stageAcc;
  }, {});

  await updateStage(caseId, nextStage.id);

  await publishCaseStageUpdated({
    caseRef: kase.caseRef,
    previousStage: kase.currentStage,
    currentStage: nextStage,
  });
};
