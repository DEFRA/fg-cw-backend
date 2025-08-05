import Joi from "joi";
import { emailSchema } from "../user/email.schema.js";
import { idpIdSchema } from "../user/idp-id.schema.js";
import { idpRoleSchema } from "../user/idp-role.schema.js";
import { nameSchema } from "../user/name.schema.js";
import { userRoleSchema } from "../user/user-role.schema.js";

export const createUserRequestSchema = Joi.object({
  idpId: idpIdSchema,
  email: emailSchema,
  name: nameSchema,
  idpRoles: Joi.array().items(idpRoleSchema),
  appRoles: userRoleSchema.optional(),
})
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("CreateUserRequest");
