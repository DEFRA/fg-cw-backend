import Joi from "joi";
import { codeSchema } from "../../../common/schemas/roles/code.schema.js";
import { emailSchema } from "../user/email.schema.js";
import { idpIdSchema } from "../user/idp-id.schema.js";
import { idpRoleSchema } from "../user/idp-role.schema.js";
import { nameSchema } from "../user/name.schema.js";

export const createUserRequestSchema = Joi.object({
  idpId: idpIdSchema,
  email: emailSchema,
  name: nameSchema,
  idpRoles: Joi.array().items(idpRoleSchema),
  appRoles: Joi.array().items(codeSchema).optional(),
})
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("CreateUserRequest");
