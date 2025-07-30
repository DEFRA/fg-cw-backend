import JoiDate from "@joi/date";
import BaseJoi from "joi";
import { parseToUTCDate } from "../../dateParser.js";

const joi = BaseJoi.extend(JoiDate);

export const userRoleSchema = joi
  .object()
  .pattern(
    joi.string().required(),
    joi
      .object({
        startDate: joi
          .alternatives()
          .try(
            joi
              .string()
              .pattern(/^\d{2}\/\d{2}\/\d{4}$/)
              .custom(parseToUTCDate),
            joi.date(),
          )
          .optional(),
        endDate: joi
          .alternatives()
          .try(
            joi
              .string()
              .pattern(/^\d{2}\/\d{2}\/\d{4}$/)
              .custom(parseToUTCDate),
            joi.date(),
          )
          .optional(),
      })
      .optional(),
  )
  .options({
    stripUnknown: true,
  })
  .label("UserRoleSchema");
