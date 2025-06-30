import Joi from "joi";
import { emailSchema } from "../user/email.schema.js";
import { idpIdSchema } from "../user/idp-id.schema.js";
import { nameSchema } from "../user/name.schema.js";
import { appRoleSchema } from "../user/roles/app-role.schema.js";
import { idpRoleSchema } from "../user/roles/idp-role.schema.js";

export const createUserRequestSchema = Joi.object({
  idpId: idpIdSchema,
  email: emailSchema,
  name: nameSchema,
  idpRoles: Joi.array().items(idpRoleSchema),
  appRoles: Joi.array().items(appRoleSchema).optional(),
})
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("CreateUserRequest");
