import Boom from "@hapi/boom";
import Joi from "joi";
import { assertInstanceOf } from "../../common/assert.js";
import { comment } from "../schemas/comment.schema.js";
import { UrlSafeId } from "../schemas/url-safe-id.schema.js";

export const TaskStatus = Joi.string().valid("complete", "pending");

export class Task {
  static validationSchema = Joi.object({
    id: Joi.string()
      .regex(/[a-z0-9-]/)
      .required(),
    status: TaskStatus.required(),
    type: Joi.string().valid("boolean").optional(),
    title: Joi.string().optional(),
    updatedAt: Joi.string().isoDate().optional().allow(null),
    updatedBy: Joi.string().allow(null),
    commentRef: UrlSafeId.optional().allow(null, ""),
    comment: comment.optional().allow(null),
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
    this.title = value.title;
    this.type = value.type;
    this.comment = value.comment;
    this.status = value.status;
    this.commentRef = value.commentRef;
    this.updatedAt = value.updatedAt;
    this.updatedBy = value.updatedBy;
  }

  updateStatus(status, updatedBy, comment) {
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

    if (value === "complete") {
      this.commentRef = comment?.ref;
    }
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

export const assertIsTask = (obj) => {
  return assertInstanceOf(obj, Task, "Task");
};
