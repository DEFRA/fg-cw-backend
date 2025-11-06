import Boom from "@hapi/boom";
import Joi from "joi";
import { requiredRolesSchema } from "../schemas/requiredRoles.schema.js";
import { UrlSafeId } from "../schemas/url-safe-id.schema.js";

export const TaskStatus = Joi.string().allow(null);

export class CaseTask {
  static validationSchema = Joi.object({
    code: UrlSafeId.required().label("code"),
    status: TaskStatus.required(),
    completed: Joi.boolean().optional(),
    updatedAt: Joi.string().isoDate().optional().allow(null),
    updatedBy: Joi.string().allow(null),
    commentRef: UrlSafeId.optional().allow(null, "").label("commentRef"),
    requiredRoles: requiredRolesSchema.optional(),
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
    this.status = value.status;
    this.completed = value.completed;
    this.commentRef = value.commentRef;
    this.updatedAt = value.updatedAt;
    this.updatedBy = value.updatedBy;
    this.requiredRoles = value.requiredRoles;
  }

  updateStatus({ status, completed, updatedBy }) {
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
    this.completed = completed;
    this.updatedBy = updatedBy;
    this.updatedAt = new Date().toISOString();
  }

  updateCommentRef(commentRef) {
    this.commentRef = commentRef;
  }

  getUserIds() {
    return this.updatedBy ? [this.updatedBy] : [];
  }
}
