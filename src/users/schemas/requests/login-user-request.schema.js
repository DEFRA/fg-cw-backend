import Joi from "joi";
import { emailSchema } from "../user/email.schema.js";
import { idpIdSchema } from "../user/idp-id.schema.js";
import { idpRoleSchema } from "../user/idp-role.schema.js";
import { nameSchema } from "../user/name.schema.js";

export const loginUserRequestSchema = Joi.object({
  idpId: idpIdSchema.required(),
  name: nameSchema.required(),
  email: emailSchema.required(),
  idpRoles: Joi.array().items(idpRoleSchema).required(),
})
  .options({
    stripUnknown: true,
  })
  .label("LoginUserRequest");
