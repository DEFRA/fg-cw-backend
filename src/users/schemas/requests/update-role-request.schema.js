import Joi from "joi";
import { descriptionSchema } from "../roles/description.schema.js";

export const updateRoleRequestSchema = Joi.object({
  description: descriptionSchema,
  assignable: Joi.boolean(),
})
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("UpdateRoleRequest");
