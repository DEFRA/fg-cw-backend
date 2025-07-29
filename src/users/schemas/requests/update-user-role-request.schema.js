import Joi from "joi";
import { codeSchema } from "../../../common/schemas/roles/code.schema.js";

export const updateUserRoleRequestSchema = Joi.object({
  roleName: codeSchema,
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
})
  .options({
    stripUnknown: true,
  })
  .label("UpdateUserRoleRequest");
