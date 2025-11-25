import { logger } from "../../common/logger.js";
import { withTransaction } from "../../common/with-transaction.js";
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

const createCaseTaskGroup = (taskGroup) =>
  new CaseTaskGroup({
    code: taskGroup.code,
    tasks: taskGroup.tasks.map(createCaseTask),
  });

const createCaseStage = (stage) =>
  new CaseStage({
    code: stage.code,
    taskGroups: stage.taskGroups.map(createCaseTaskGroup),
  });

const createCasePhase = (phase) =>
  new CasePhase({
    code: phase.code,
    stages: phase.stages.map(createCaseStage),
  });

export const createCaseUseCase = async (message) => {
  logger.debug("Creating case use case started.");
  return await withTransaction(async (session) => {
    const {
      event: { data },
    } = message;
    const { caseRef, workflowCode, payload } = data;

    const workflow = await findWorkflowByCodeUseCase(workflowCode);

    const position = workflow.getInitialPosition();

    const kase = Case.new({
      caseRef,
      workflowCode,
      position,
      payload,
      phases: workflow.phases.map(createCasePhase),
    });

    logger.info(
      `Finished: Creating case use case started with caseRef "${caseRef}" and workflowCode "${workflowCode}" to database.`,
    );

    await save(kase, session);
  });
};
