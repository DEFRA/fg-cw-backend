import JoiDate from "@joi/date";
import BaseJoi from "joi";
import { codeSchema } from "./code.schema.js";

const joi = BaseJoi.extend(JoiDate);

export const userRoleSchema = joi
  .object()
  .pattern(
    codeSchema,
    joi
      .object({
        startDate: joi.date().format("YYYY-MM-DD").raw().optional(),
        endDate: joi.date().format("YYYY-MM-DD").raw().optional(),
      })
      .optional(),
  )
  .options({
    stripUnknown: true,
  })
  .label("UserRoleSchema");
