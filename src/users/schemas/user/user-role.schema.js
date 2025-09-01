import JoiDate from "@joi/date";
import BaseJoi from "joi";
import { codeSchema } from "../../../common/schemas/roles/code.schema.js";

const joi = BaseJoi.extend(JoiDate);

export const userRoleSchema = joi
  .object()
  .pattern(
    codeSchema,
    joi
      .object({
        startDate: joi
          .string()
          .custom((value, helpers) => {
            const { error } = joi.date().iso().validate(value);
            if (error) {
              return helpers.error("date.format");
            }
            return value;
          })
          .optional()
          .description("Start date in YYYY-MM-DD format")
          .example("2025-01-31")
          .messages({
            "date.format":
              "Start date must be a valid ISO date string (YYYY-MM-DD)",
          }),

        endDate: joi
          .string()
          .custom((value, helpers) => {
            const { error } = joi.date().iso().validate(value);
            if (error) {
              return helpers.error("date.format");
            }
            return value;
          })
          .optional()
          .description("End date in YYYY-MM-DD format")
          .example("2025-10-31")
          .messages({
            "date.format":
              "End date must be a valid ISO date string (YYYY-MM-DD)",
          }),
      })
      .optional(),
  )
  .options({
    stripUnknown: true,
  })
  .label("UserRoleSchema");
