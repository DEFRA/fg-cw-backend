import Joi from "joi";
import { nameSchema } from "../user/name.schema.js";
import { appRoleSchema } from "../user/roles/app-role.schema.js";
import { idpRoleSchema } from "../user/roles/idp-role.schema.js";

export const updateUserRequestSchema = Joi.object({
  name: nameSchema,
  idpRoles: Joi.array().items(idpRoleSchema).optional(),
  appRoles: Joi.array().items(appRoleSchema).optional(),
})
  .options({
    stripUnknown: true,
  })
  .label("UpdateUserRequest");
