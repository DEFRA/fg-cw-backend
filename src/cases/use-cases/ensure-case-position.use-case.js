import { logger } from "../../common/logger.js";
import { evaluateTaskCondition } from "../../common/resolve-json.js";
import { CasePhase } from "../models/case-phase.js";
import { CaseStage } from "../models/case-stage.js";
import { CaseTaskGroup } from "../models/case-task-group.js";
import { CaseTask } from "../models/case-task.js";

export const createCaseTask = (task) =>
  new CaseTask({
    code: task.code,
    value: null,
    completed: false,
    updatedAt: null,
    updatedBy: null,
  });

export const createCaseTaskGroup = async (taskGroup, root) => {
  const tasks = await taskGroup.tasks.reduce(async (accPromise, task) => {
    const acc = await accPromise;
    const include = await evaluateTaskCondition({
      condition: task.conditional,
      root,
    });
    return include ? [...acc, createCaseTask(task)] : acc;
  }, Promise.resolve([]));

  return new CaseTaskGroup({ code: taskGroup.code, tasks });
};

export const createCaseStage = async (stage, root) =>
  new CaseStage({
    code: stage.code,
    taskGroups: await Promise.all(
      stage.taskGroups.map((tg) => createCaseTaskGroup(tg, root)),
    ),
  });

const createTargetStage = (workflow, { phaseCode, stageCode }, root) =>
  createCaseStage(workflow.findPhase(phaseCode).findStage(stageCode), root);

export const ensureCasePosition = async (kase, workflow, targetPosition) => {
  const { phaseCode, stageCode } = targetPosition;
  const root = {
    ...kase,
    supplementaryData: kase.supplementaryData.toJSON(),
    position: targetPosition,
  };

  if (!kase.hasPhase(phaseCode)) {
    const caseStage = await createTargetStage(workflow, targetPosition, root);

    kase.phases.push(
      new CasePhase({
        code: phaseCode,
        stages: [caseStage],
      }),
    );

    logger.info(
      `Created phase ${phaseCode} with stage ${stageCode} for case ${kase.caseRef}`,
    );
    return;
  }

  const casePhase = kase.findPhase(phaseCode);

  if (!casePhase.hasStage(stageCode)) {
    const caseStage = await createTargetStage(workflow, targetPosition, root);

    casePhase.addStage(caseStage);

    logger.info(
      `Created stage ${stageCode} in phase ${phaseCode} for case ${kase.caseRef}`,
    );
  }
};
