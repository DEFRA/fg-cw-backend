import { logger } from "../../common/logger.js";
import { evaluateTaskCondition } from "../../common/resolve-json.js";
import { CasePhase } from "../models/case-phase.js";
import { CaseStage } from "../models/case-stage.js";
import { CaseTaskGroup } from "../models/case-task-group.js";
import { CaseTask } from "../models/case-task.js";
import { Case } from "../models/case.js";
import { save } from "../repositories/case.repository.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

const createCaseTask = (task) =>
  new CaseTask({
    code: task.code,
    status: null,
    completed: false,
    commentRef: null,
    updatedAt: null,
    updatedBy: null,
  });

const createCaseTaskGroup = async (taskGroup, root) => {
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

const createCaseStage = async (stage, root) =>
  new CaseStage({
    code: stage.code,
    taskGroups: await Promise.all(
      stage.taskGroups.map((tg) => createCaseTaskGroup(tg, root)),
    ),
  });

const createCasePhase = async (phase, root) =>
  new CasePhase({
    code: phase.code,
    stages: await Promise.all(
      phase.stages.map((s) => createCaseStage(s, root)),
    ),
  });

export const newCaseUseCase = async (message, session) => {
  const {
    event: { data },
  } = message;
  const { caseRef, workflowCode, payload } = data;

  logger.info(
    `Creating new case with caseRef ${caseRef} and workflowCode ${workflowCode}`,
  );

  const workflow = await findWorkflowByCodeUseCase(workflowCode);

  const position = workflow.getInitialPosition();

  const root = { payload };
  const phases = await Promise.all(
    workflow.phases.map((phase) => createCasePhase(phase, root)),
  );

  const kase = Case.new({
    caseRef,
    workflowCode,
    position,
    payload,
    phases,
  });

  const { insertedId } = await save(kase, session);

  logger.info(
    `Finished: Creating new case with caseRef ${caseRef} and workflowCode ${workflowCode}`,
  );

  return insertedId;
};
