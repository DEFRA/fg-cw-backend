import Joi from "joi";
import { codeSchema } from "../roles/code.schema.js";
import { descriptionSchema } from "../roles/description.schema.js";

export const createRoleRequestSchema = Joi.object({
  code: codeSchema,
  description: descriptionSchema,
})
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("CreateRoleRequest");
