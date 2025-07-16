import Joi from "joi";
import { codeSchema } from "../../common/schemas/roles/code.schema.js";

export const requiredRolesSchema = Joi.object({
  allOf: Joi.array().items(codeSchema).required(),
  anyOf: Joi.array().items(codeSchema).required(),
});
