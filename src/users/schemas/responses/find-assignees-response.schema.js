import Joi from "joi";

import { idSchema } from "../../../common/schemas/user/id.schema.js";
import { nameSchema } from "../user/name.schema.js";

export const findAssigneesResponseSchema = Joi.array()
  .items(
    Joi.object({
      id: idSchema,
      name: nameSchema,
    })
      .required()
      .options({
        presence: "required",
        stripUnknown: true,
      }),
  )
  .required()
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("FindAssigneesResponse");
