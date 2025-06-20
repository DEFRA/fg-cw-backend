import Joi from "joi";
import { emailSchema } from "../user/email.schema.js";
import { firstNameSchema } from "../user/first-name.schema.js";
import { idpIdSchema } from "../user/idp-id.schema.js";
import { lastNameSchema } from "../user/last-name.schema.js";
import { appRoleSchema } from "../user/roles/app-role.schema.js";
import { idpRoleSchema } from "../user/roles/idp-role.schema.js";

export const createUserRequestSchema = Joi.object({
  idpId: idpIdSchema,
  email: emailSchema,
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  idpRoles: Joi.array().items(idpRoleSchema),
  appRoles: Joi.array().items(appRoleSchema),
})
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("CreateUserRequest");
