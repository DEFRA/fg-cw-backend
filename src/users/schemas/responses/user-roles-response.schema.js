import Joi from "joi";
import { codeSchema } from "../../../common/schemas/roles/code.schema.js";

const appRoleSchema = Joi.object({
  roleName: codeSchema.required().description("App role code"),
  from: Joi.string()
    .allow(null)
    .required()
    .description("Start date in YYYY-MM-DD format, or null if open-ended")
    .example("2025-01-31"),
  to: Joi.string()
    .allow(null)
    .required()
    .description("End date in YYYY-MM-DD format, or null if open-ended")
    .example("2025-10-31"),
})
  .options({ stripUnknown: true })
  .label("AppRole");

export const userRolesResponseSchema = Joi.object({
  appRoles: Joi.array()
    .items(appRoleSchema)
    .required()
    .description("The user's currently active app roles, empty if none"),
})
  .options({ stripUnknown: true })
  .label("UserRolesResponse");
