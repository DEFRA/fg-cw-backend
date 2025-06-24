import Joi from "joi";
import { firstNameSchema } from "../user/first-name.schema.js";
import { lastNameSchema } from "../user/last-name.schema.js";
import { appRoleSchema } from "../user/roles/app-role.schema.js";
import { idpRoleSchema } from "../user/roles/idp-role.schema.js";

export const updateUserRequestSchema = Joi.object({
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  idpRoles: Joi.array().items(idpRoleSchema).optional(),
  appRoles: Joi.array().items(appRoleSchema).optional(),
})
  .options({
    stripUnknown: true,
  })
  .label("UpdateUserRequest");
