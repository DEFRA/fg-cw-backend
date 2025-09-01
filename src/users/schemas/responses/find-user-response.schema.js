import JoiDate from "@joi/date";
import BaseJoi from "joi";

import { codeSchema } from "../../../common/schemas/roles/code.schema.js";
import { idSchema } from "../../../common/schemas/user/id.schema.js";
import { emailSchema } from "../user/email.schema.js";
import { idpIdSchema } from "../user/idp-id.schema.js";
import { idpRoleSchema } from "../user/idp-role.schema.js";
import { nameSchema } from "../user/name.schema.js";

const Joi = BaseJoi.extend(JoiDate);

export const findUserResponseSchema = Joi.object({
  id: idSchema,
  idpId: idpIdSchema,
  name: nameSchema,
  email: emailSchema,
  idpRoles: Joi.array().items(idpRoleSchema),
  appRoles: Joi.object().pattern(
    codeSchema,
    Joi.object({
      startDate: Joi.date().iso().optional(),
      endDate: Joi.date().iso().optional(),
    }).optional(),
  ),
})
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("FindUserResponse");
