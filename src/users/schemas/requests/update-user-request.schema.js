import Joi from "joi";
import { firstNameSchema } from "../user/first-name.schema.js";
import { lastNameSchema } from "../user/last-name.schema.js";
import { idpRoleSchema } from "../user/roles/idp-role.schema.js";

export const updateUserRequestSchema = Joi.object({
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  roles: Joi.object({
    idp: Joi.array().items(idpRoleSchema),
  }),
})
  .options({
    stripUnknown: true,
  })
  .label("UpdateUserRequest");
