import JoiDate from "@joi/date";
import BaseJoi from "joi";

const joi = BaseJoi.extend(JoiDate);

export const userRoleSchema = joi
  .object()
  .pattern(
    joi.string().required(), // Role name as key (e.g., "ROLE_ADMIN")
    joi
      .object({
        startDate: joi.date().format("DD/MM/YYYY").optional(),
        endDate: joi.date().format("DD/MM/YYYY").optional(),
      })
      .optional(),
  )
  .options({
    stripUnknown: true,
  })
  .label("UserRoleSchema");
