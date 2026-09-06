import Joi from "joi";

import { valueSchema } from "../cases/stages/tasks/value.schema.js";

export const updateTaskStatusRequestSchema = Joi.object({
  value: valueSchema,
  completed: Joi.boolean().allow(null),
  comment: Joi.string().optional().allow(null),
})
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("UpdateTaskStatusRequest");
