import Joi from "joi";

import { statusSchema } from "../cases/stages/tasks/status.schema.js";

export const updateTaskStatusRequestSchema = Joi.object({
  status: statusSchema,
  completed: Joi.boolean().optional().allow(null),
  comment: Joi.string().optional().allow(null),
})
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("UpdateTaskStatusRequest");
