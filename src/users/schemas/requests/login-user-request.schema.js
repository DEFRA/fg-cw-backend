import Joi from "joi";
import { codeSchema } from "../../../common/schemas/roles/code.schema.js";
import { emailSchema } from "../user/email.schema.js";
import { idpIdSchema } from "../user/idp-id.schema.js";
import { idpRoleSchema } from "../user/idp-role.schema.js";
import { nameSchema } from "../user/name.schema.js";
import { userRoleObjectSchema } from "../user/user-role.schema.js";

export const loginUserRequestSchema = Joi.object({
  idpId: idpIdSchema.required(),
  name: nameSchema.required(),
  email: emailSchema.required(),
  idpRoles: Joi.array().items(idpRoleSchema).required(),
  appRoles: Joi.object()
    .pattern(codeSchema, userRoleObjectSchema.optional())
    .optional()
    .default({})
    .options({
      stripUnknown: true,
    })
    .label("UserRoleSchema"),
})
  .options({
    stripUnknown: true,
  })
  .label("LoginUserRequest");
