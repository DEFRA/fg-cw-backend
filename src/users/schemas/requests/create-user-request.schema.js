import Joi from "joi";
import { emailSchema } from "../user/email.schema.js";
import { nameSchema } from "../user/name.schema.js";

export const createUserRequestSchema = Joi.object({
  name: nameSchema.required(),
  email: emailSchema.required(),
})
  .options({
    stripUnknown: true,
  })
  .label("CreateUserRequest");
