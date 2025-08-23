import Joi from "joi";
import { statusSchema } from "../schemas/cases/stages/tasks/status.schema.js";
import { validateModel } from "./validate-model.js";

export class Task {
  static schema = Joi.object({
    id: Joi.string().required(),
    status: statusSchema.required(),
    commentRef: Joi.string().allow(null).optional(),
    updatedAt: Joi.string().allow(null).isoDate().optional(),
    updatedBy: Joi.string().allow(null).optional(),
  }).label("TaskSchema");

  constructor(props) {
    const value = validateModel(props, Task.schema);
    this.id = value.id;
    this.status = value.status;
    this.commentRef = value.commentRef;
    this.updatedAt = value.updatedAt;
    this.updatedBy = value.updatedBy;
  }
}
