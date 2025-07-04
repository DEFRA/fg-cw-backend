import Joi from "joi";
import { codeSchema } from "../roles/code.schema.js";
import { idpRoleSchema } from "../user/idp-role.schema.js";
import { nameSchema } from "../user/name.schema.js";

export const updateUserRequestSchema = Joi.object({
  name: nameSchema,
  idpRoles: Joi.array().items(idpRoleSchema).optional(),
  appRoles: Joi.array().items(codeSchema).optional(),
})
  .options({
    stripUnknown: true,
  })
  .label("UpdateUserRequest");
