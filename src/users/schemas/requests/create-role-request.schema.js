import Joi from "joi";
import { codeSchema } from "../../../common/schemas/roles/code.schema.js";
import { descriptionSchema } from "../roles/description.schema.js";

export const createRoleRequestSchema = Joi.object({
  code: codeSchema,
  description: descriptionSchema,
  assignable: Joi.boolean(),
})
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("CreateRoleRequest");
