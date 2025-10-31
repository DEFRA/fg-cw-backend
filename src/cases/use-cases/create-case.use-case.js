import { CasePhase } from "../models/case-phase.js";
import { CaseStage } from "../models/case-stage.js";
import { CaseTaskGroup } from "../models/case-task-group.js";
import { CaseTask } from "../models/case-task.js";
import { Case } from "../models/case.js";
import { publishCaseStatusUpdated } from "../publishers/case-event.publisher.js";
import { save } from "../repositories/case.repository.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

const createCaseTask = (task) =>
  new CaseTask({
    code: task.code,
    status: "pending",
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

export const createCaseUseCase = async ({ caseRef, workflowCode, payload }) => {
  const workflow = await findWorkflowByCodeUseCase(workflowCode);

  const kase = Case.new({
    caseRef,
    workflowCode,
    payload,
    phases: workflow.phases.map(createCasePhase),
  });

  await save(kase);

  // FGP-659 - send event back to GAS to update the status to IN_PROGRESS
  // This can be removed when we have state transitions in CW-BE
  await publishCaseStatusUpdated({
    caseRef,
    workflowCode: kase.workflowCode,
    previousStatus: "NEW",
    currentStatus: "IN_PROGRESS",
  });

  return kase;
};
