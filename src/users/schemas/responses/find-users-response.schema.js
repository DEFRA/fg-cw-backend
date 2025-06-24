import Joi from "joi";
import { findUserResponseSchema } from "./find-user-response.schema.js";

export const findUsersResponseSchema = Joi.array()
  .items(findUserResponseSchema)
  .required()
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("FindUsersResponse");
