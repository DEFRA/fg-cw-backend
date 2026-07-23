import Boom from "@hapi/boom";
import { AccessControl } from "../../common/access-control.js";
import {
  auditActions,
  auditEntities,
  buildAuditSecurity,
} from "../../common/audit-constants.js";
import { buildSecurityContext } from "../../common/audit-security-context.js";
import { logger } from "../../common/logger.js";
import { withAudit } from "../../common/with-audit.js";
import { IdpRoles } from "../../users/models/idp-roles.js";
import { findById, update } from "../repositories/case.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";

export const validatePayloadComment = (comment, required) => {
  if (required && !comment) {
    throw Boom.badRequest("Comment is required");
  }
};

const updateTaskStatus = async (command) => {
  logger.info(`Updating task status of case "${command.caseId}"`);

  const { caseId, taskGroupCode, taskCode, status, completed, comment, user } =
    command;

  const kase = await findById(caseId);

  if (!kase) {
    throw Boom.notFound(`Case with id "${caseId}" not found`);
  }

  const workflow = await findByCode(kase.workflowCode);

  const currentStatus = workflow.getStatus(kase.position);

  if (currentStatus.interactive === false) {
    throw Boom.badRequest(
      `The task ${taskGroupCode}/${taskCode} cannot be modified while case is in ${kase.position}`,
    );
  }

  const task = workflow.findTask({
    phaseCode: kase.position.phaseCode,
    stageCode: kase.position.stageCode,
    taskGroupCode,
    taskCode,
  });

  AccessControl.authorise(user, {
    idpRoles: [IdpRoles.ReadWrite],
    appRoles: task.getRequiredRoles(),
  });

  validatePayloadComment(comment, task.comment?.mandatory === true);

  const taskCompleted = mapCompleted({ task, status, completed });

  kase.setTaskStatus({
    taskGroupCode,
    taskCode,
    status,
    completed: taskCompleted,
    comment,
    updatedBy: user.id,
  });

  logger.info(`Finished: Updating task status of case "${command.caseId}"`);

  return update(kase);
};

export const updateTaskStatusAuditDataBuilder = ([command]) => ({
  entities: [
    {
      entity: auditEntities.CASE,
      action: auditActions.UPDATE_TASK_STATUS,
      entityid: command.caseId,
    },
  ],
  details: {
    security: buildSecurityContext(command.user),
    task: {
      taskGroupCode: command.taskGroupCode,
      taskCode: command.taskCode,
      status: command.status,
      completed: command.completed,
    },
  },
  security: buildAuditSecurity(auditActions.UPDATE_TASK_STATUS),
  messageGroupId: `update-task-status-${command.caseId}`,
});

export const updateTaskStatusUseCase = withAudit(
  updateTaskStatus,
  updateTaskStatusAuditDataBuilder,
);

const mapCompleted = ({ task, status, completed }) => {
  if (!hasStatusOptions(task)) {
    return completed;
  }

  const selectedOption = task.statusOptions.find(
    (option) => option.code === status,
  );

  if (!selectedOption) {
    throw Boom.badRequest(
      `Invalid status option "${status}" for task "${task.code}". Valid options are: ${task.statusOptions.map((o) => o.code).join(", ")}`,
    );
  }

  return selectedOption.completes;
};

const hasStatusOptions = (task) =>
  task?.statusOptions && task?.statusOptions.length > 0;
