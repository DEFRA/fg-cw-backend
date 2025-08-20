import Joi from "joi";

import { statusSchema } from "../cases/stages/tasks/status.schema.js";

export const updateTaskStatusRequestSchema = Joi.object({
  status: statusSchema.required(),
  comment: Joi.string().allow(null),
})
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("UpdateTaskStatusRequest");
