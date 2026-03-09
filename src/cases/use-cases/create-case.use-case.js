import { JSONPath } from "jsonpath-plus";
import { logger } from "../../common/logger.js";
import { withTransaction } from "../../common/with-transaction.js";
import { CasePhase } from "../models/case-phase.js";
import { CaseStage } from "../models/case-stage.js";
import { CaseTaskGroup } from "../models/case-task-group.js";
import { CaseTask } from "../models/case-task.js";
import { Case } from "../models/case.js";
import { save } from "../repositories/case.repository.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

const evaluateCondition = (conditional, payload) => {
  if (!conditional) {
    return true;
  }
  const result = JSONPath({ json: { payload }, path: conditional });
  if (Array.isArray(result)) {
    return result.length > 0 && Boolean(result[0]);
  }
  return Boolean(result);
};

const createCaseTask = (task) =>
  new CaseTask({
    code: task.code,
    status: null,
    completed: false,
    commentRef: null,
    updatedAt: null,
    updatedBy: null,
  });

const createCaseTaskGroup = (taskGroup, payload) =>
  new CaseTaskGroup({
    code: taskGroup.code,
    tasks: taskGroup.tasks
      .filter((task) => evaluateCondition(task.conditional, payload))
      .map(createCaseTask),
  });

const createCaseStage = (stage, payload) =>
  new CaseStage({
    code: stage.code,
    taskGroups: stage.taskGroups.map((tg) => createCaseTaskGroup(tg, payload)),
  });

const createCasePhase = (phase, payload) =>
  new CasePhase({
    code: phase.code,
    stages: phase.stages.map((s) => createCaseStage(s, payload)),
  });

export const createCaseUseCase = async (message) => {
  return await withTransaction(async (session) => {
    const {
      event: { data },
    } = message;
    const { caseRef, workflowCode, payload } = data;

    logger.info(
      `Creating case with caseRef ${caseRef} and workflowCode ${workflowCode}`,
    );

    const workflow = await findWorkflowByCodeUseCase(workflowCode);

    const position = workflow.getInitialPosition();

    const kase = Case.new({
      caseRef,
      workflowCode,
      position,
      payload,
      phases: workflow.phases.map((phase) => createCasePhase(phase, payload)),
    });

    logger.info(
      `Finished: Creating case with caseRef ${caseRef} and workflowCode ${workflowCode}`,
    );

    await save(kase, session);
  });
};
