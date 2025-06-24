import Joi from "joi";
import { emailSchema } from "../user/email.schema.js";
import { firstNameSchema } from "../user/first-name.schema.js";
import { idSchema } from "../user/id.schema.js";
import { idpIdSchema } from "../user/idp-id.schema.js";
import { lastNameSchema } from "../user/last-name.schema.js";
import { appRoleSchema } from "../user/roles/app-role.schema.js";
import { idpRoleSchema } from "../user/roles/idp-role.schema.js";

export const findUserResponseSchema = Joi.object({
  id: idSchema,
  idpId: idpIdSchema,
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  email: emailSchema,
  idpRoles: Joi.array().items(idpRoleSchema),
  appRoles: Joi.array().items(appRoleSchema),
})
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("FindUserResponse");
