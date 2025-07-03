import Joi from "joi";
import { codeSchema } from "../roles/code.schema.js";
import { descriptionSchema } from "../roles/description.schema.js";
import { idSchema } from "../roles/id.schema.js";

export const findRoleResponseSchema = Joi.object({
  id: idSchema,
  code: codeSchema,
  description: descriptionSchema,
  createdAt: Joi.string().isoDate(),
  updatedAt: Joi.string().isoDate(),
})
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("FindRoleResponse");
