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
import { update } from "../repositories/case.repository.js";
import { loadCase } from "./load-case.js";
import {
  persistResolvedVersion,
  resolveWorkflowForCase,
} from "./resolve-current-workflow.use-case.js";

export const validatePayloadComment = (comment, required) => {
  if (required && !comment) {
    throw Boom.badRequest("Comment is required");
  }
};

const updateTaskStatus = async (command) => {
  logger.info(`Updating task value for case "${command.caseId}"`);

  const { taskGroupCode, taskCode, value, completed, comment, user } = command;

  const kase = await loadCase(command);

  const { workflow, resolvedVersion } = await resolveWorkflowForCase(kase);
  await persistResolvedVersion(kase, resolvedVersion);

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

  const taskCompleted = mapCompleted({ task, value, completed });

  kase.setTaskValue({
    taskGroupCode,
    taskCode,
    value,
    completed: taskCompleted,
    comment,
    updatedBy: user.id,
  });

  logger.info(`Finished: Updating task value for case "${command.caseId}"`);

  return update(kase);
};

export const updateTaskStatusAuditDataBuilder = ([command]) => ({
  entities: [
    {
      entity: auditEntities.CASE,
      action: auditActions.UPDATE_TASK_STATUS,
      entityid: command.caseRef ?? command.caseId,
    },
  ],
  details: {
    security: buildSecurityContext(command.user),
    task: {
      taskGroupCode: command.taskGroupCode,
      taskCode: command.taskCode,
      value: command.value,
      completed: command.completed,
    },
  },
  security: buildAuditSecurity(auditActions.UPDATE_TASK_STATUS),
  segregationRef: `update-task-value-${command.caseId}`,
});

export const updateTaskStatusUseCase = withAudit(
  updateTaskStatus,
  updateTaskStatusAuditDataBuilder,
);

const mapCompleted = ({ task, value, completed }) => {
  if (hasInput(task)) {
    return mapInputCompleted(task, value);
  }

  if (!hasValueOptions(task)) {
    return completed;
  }

  const selectedOption = task.valueOptions.find(
    (option) => option.code === value,
  );

  if (!selectedOption) {
    throw Boom.badRequest(
      `Invalid value option "${value}" for task "${task.code}". Valid options are: ${task.valueOptions.map((o) => o.code).join(", ")}`,
    );
  }

  return selectedOption.completes;
};

const hasValueOptions = (task) =>
  task?.valueOptions && task?.valueOptions.length > 0;

const hasInput = (task) => Boolean(task?.input);

const isEmptyValue = (value) =>
  value === null || value === undefined || String(value).trim() === "";

const mapInputCompleted = (task, value) => {
  if (isEmptyValue(value)) {
    return false;
  }

  validateInputValue(task, String(value));

  return true;
};

const validateInputValue = (task, value) => {
  const validators = {
    text: validateTextInput,
    number: validateNumberInput,
    date: validateDateInput,
  };

  validators[task.input.type](task, value);
};

const invalidValue = (task, value, reason) =>
  Boom.badRequest(
    `Invalid value "${value}" for task "${task.code}": ${reason}`,
  );

const validateTextInput = (task, value) => {
  validateMaxLength(task, value);
  validatePattern(task, value);
};

const validateMaxLength = (task, value) => {
  const { maxlength } = task.input;

  if (maxlength !== undefined && value.length > maxlength) {
    throw invalidValue(task, value, `must be ${maxlength} characters or fewer`);
  }
};

const validatePattern = (task, value) => {
  const { pattern } = task.input;

  if (pattern === undefined) {
    return;
  }

  const valid = new RegExp(`^(?:${pattern})$`).test(value);
  if (!valid) {
    throw invalidValue(task, value, `must match the pattern ${pattern}`);
  }
};

const validateNumberInput = (task, value) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    throw invalidValue(task, value, "must be a number");
  }

  validateMin(task, value, numericValue);
  validateMax(task, value, numericValue);
};

const validateMin = (task, value, numericValue) => {
  const { min } = task.input;

  if (min !== undefined && numericValue < min) {
    throw invalidValue(task, value, `must be ${min} or more`);
  }
};

const validateMax = (task, value, numericValue) => {
  const { max } = task.input;

  if (max !== undefined && numericValue > max) {
    throw invalidValue(task, value, `must be ${max} or less`);
  }
};

const validateDateInput = (task, value) => {
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;

  if (!isoDate.test(value) || !isRealDate(value)) {
    throw invalidValue(
      task,
      value,
      "must be a valid date in YYYY-MM-DD format",
    );
  }
};

const isRealDate = (value) => {
  const parsed = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
  );
};
