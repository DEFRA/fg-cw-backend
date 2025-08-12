import Joi from "joi";
import { idSchema } from "../../../common/schemas/user/id.schema.js";

export const assignUserToCaseRequestSchema = Joi.object({
  assignedUserId: idSchema.allow(null),
  notes: Joi.string().allow("").optional(),
})
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("AssignUserToCaseRequest");
