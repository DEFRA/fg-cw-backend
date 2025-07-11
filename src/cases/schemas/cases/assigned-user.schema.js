import Joi from "joi";
import { idSchema } from "../../../common/schemas/user/id.schema.js";

export const assignedUserSchema = Joi.object({
  id: idSchema,
  name: Joi.string(),
})
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("AssignedUser");
