import Joi from "joi";

import { statusSchema } from "../cases/stages/tasks/status.schema.js";

export const updateTaskStatusRequestSchema = Joi.object({
  status: statusSchema.required(),
})
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("UpdateTaskStatusRequest");
