import Boom from "@hapi/boom";
import { logger } from "../../common/logger.js";
import { IdpRoles } from "../../users/models/idp-roles.js";
import { AccessControl } from "../models/access-control.js";
import { findById, update } from "../repositories/case.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";

export const validatePayloadComment = (comment, required) => {
  if (required && !comment) {
    throw Boom.badRequest("Comment is required");
  }
};

export const updateTaskStatusUseCase = async (command) => {
  logger.info(
    `Updating task status use case started - caseId: ${command.caseId}`,
  );

  const { caseId, taskGroupCode, taskCode, status, completed, comment, user } =
    command;

  const kase = await findById(caseId);

  if (!kase) {
    throw Boom.notFound(`Case with id "${caseId}" not found`);
  }

  const workflow = await findByCode(kase.workflowCode);

  // Check if the current status is interactive
  const currentStatus = workflow.getStatus(kase.position);
  if (currentStatus.interactive === false) {
    throw Boom.badRequest(
      `Cannot update task status. The current stage status "${currentStatus.name}" is not interactive.`,
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

  logger.info(
    `Finished: Updating task status use case started - caseId: ${command.caseId}`,
  );

  return update(kase);
};

const mapCompleted = ({ task, status, completed }) => {
  if (hasStatusOptions(task)) {
    const selectedOption = task.statusOptions.find(
      (option) => option.code === status,
    );

    if (!selectedOption) {
      throw Boom.badRequest(
        `Invalid status option "${status}" for task "${task.code}". Valid options are: ${task.statusOptions.map((o) => o.code).join(", ")}`,
      );
    }

    return selectedOption.completes;
  } else {
    return completed;
  }
};

const hasStatusOptions = (task) =>
  task?.statusOptions && task?.statusOptions.length > 0;
