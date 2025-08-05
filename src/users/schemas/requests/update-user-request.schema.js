import Joi from "joi";
import { idpRoleSchema } from "../user/idp-role.schema.js";
import { nameSchema } from "../user/name.schema.js";
import { userRoleSchema } from "../user/user-role.schema.js";

export const updateUserRequestSchema = Joi.object({
  name: nameSchema,
  idpRoles: Joi.array().items(idpRoleSchema).optional(),
  appRoles: userRoleSchema.optional(),
})
  .options({
    stripUnknown: true,
  })
  .label("UpdateUserRequest");
