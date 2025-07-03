import Joi from "joi";
import { findRoleResponseSchema } from "./find-role-response.schema.js";

export const findRolesResponseSchema = Joi.array()
  .items(findRoleResponseSchema)
  .label("FindRolesResponse");
