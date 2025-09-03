import Boom from "@hapi/boom";
import Joi from "joi";
import { UrlSafeId } from "../schemas/url-safe-id.schema.js";

export const TaskStatus = Joi.string().valid("complete", "pending");

export class Task {
  static validationSchema = Joi.object({
    id: UrlSafeId.required(),
    status: TaskStatus.required(),
    updatedAt: Joi.string().isoDate().optional().allow(null),
    updatedBy: Joi.string().allow(null),
    commentRef: UrlSafeId.optional().allow(null, ""),
  });

  constructor(props) {
    const { error, value } = Task.validationSchema.validate(props, {
      stripUnknown: true,
      abortEarly: false,
    });

    if (error) {
      throw Boom.badRequest(
        `Invalid Task: ${error.details.map((d) => d.message).join(", ")}`,
      );
    }

    this.id = value.id;
    this.status = value.status;
    this.commentRef = value.commentRef;
    this.updatedAt = value.updatedAt;
    this.updatedBy = value.updatedBy;
  }

  updateStatus(status, updatedBy) {
    const { error, value } = TaskStatus.validate(status, {
      stripUnknown: true,
      abortEarly: false,
    });

    if (error) {
      throw Boom.badRequest(
        `Invalid Task Status: ${error.details.map((d) => d.message).join(", ")}`,
      );
    }

    this.status = value;
    this.updatedBy = updatedBy;
    this.updatedAt = new Date().toISOString();
  }

  updateCommentRef(commentRef) {
    this.commentRef = commentRef;
  }
}

/**
 *
 * @param {stagesObject} stages
 * @returns a new Map of tasks by task Id
 */
export const toTasks = (stages) => {
  const tasks = new Map();
  stages.forEach((s) =>
    s.taskGroups.forEach((tg) =>
      tg.tasks.forEach((t) => tasks.set(t.id, toTask(t, {}))),
    ),
  );
  return tasks;
};

export const toTask = (caseTask, workflowTask) => {
  return new Task({ ...caseTask, ...workflowTask });
};
