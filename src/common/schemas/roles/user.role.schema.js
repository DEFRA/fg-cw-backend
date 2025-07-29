import joi from "joi";
import { codeSchema } from "./code.schema.js";

export const userRoleSchema = joi
  .object({
    name: codeSchema,
    startDate: joi.date().iso().optional(),
    endDate: joi.date().iso().optional(),
  })
  .options({
    stripUnknown: true,
  })
  .label("UserRoleSchema");
