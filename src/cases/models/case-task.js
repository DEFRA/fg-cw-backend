import Boom from "@hapi/boom";
import Joi from "joi";
import { Code } from "../schemas/task.schema.js";
import { UrlSafeId } from "../schemas/url-safe-id.schema.js";

export const TaskValue = Joi.string().allow(null);

const CommentRefSchema = Joi.object({
  status: TaskValue.required(),
  ref: UrlSafeId.required(),
}).label("CommentRef");

export class CaseTask {
  static validationSchema = Joi.object({
    code: Code.required(),
    value: TaskValue.required(),
    completed: Joi.boolean(),
    updatedAt: Joi.string().isoDate().optional().allow(null),
    updatedBy: Joi.string().allow(null),
    commentRefs: Joi.array().items(CommentRefSchema).optional().default([]),
  });

  constructor(props) {
    const { error, value } = CaseTask.validationSchema.validate(props, {
      stripUnknown: true,
      abortEarly: false,
    });

    if (error) {
      throw Boom.badRequest(
        `Invalid Task: ${error.details.map((d) => d.message).join(", ")}`,
      );
    }

    this.code = value.code;
    this.value = value.value;
    this.completed = value.completed;
    this.commentRefs = value.commentRefs;
    this.updatedAt = value.updatedAt;
    this.updatedBy = value.updatedBy;
  }

  updateValue({ value, completed, updatedBy, comment }) {
    const { error, value: v } = TaskValue.validate(value, {
      stripUnknown: true,
      abortEarly: false,
    });

    if (error) {
      throw Boom.badRequest(
        `Invalid Task Status: ${error.details.map((d) => d.message).join(", ")}`,
      );
    }

    this.value = v;
    this.completed = completed;
    this.updatedBy = updatedBy;
    this.updatedAt = new Date().toISOString();

    // Append new comment ref to the array if a comment was provided
    if (comment?.ref) {
      this.commentRefs = [
        ...this.commentRefs,
        { status: value, ref: comment.ref },
      ];
    }
  }

  getUserIds() {
    return this.updatedBy ? [this.updatedBy] : [];
  }

  isComplete(workflowTask) {
    if (!workflowTask.mandatory) {
      return true;
    }

    return this.completed;
  }
}
