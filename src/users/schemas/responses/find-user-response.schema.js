import Joi from "joi";
import { codeSchema } from "../../../common/schemas/roles/code.schema.js";
import { emailSchema } from "../user/email.schema.js";
import { idSchema } from "../user/id.schema.js";
import { idpIdSchema } from "../user/idp-id.schema.js";
import { idpRoleSchema } from "../user/idp-role.schema.js";
import { nameSchema } from "../user/name.schema.js";

export const findUserResponseSchema = Joi.object({
  id: idSchema,
  idpId: idpIdSchema,
  name: nameSchema,
  email: emailSchema,
  idpRoles: Joi.array().items(idpRoleSchema),
  appRoles: Joi.array().items(codeSchema),
})
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("FindUserResponse");
