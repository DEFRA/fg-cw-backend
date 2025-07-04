import Joi from "joi";

export const codeSchema = Joi.string()
  .pattern(/ROLE_[A-Z0-9_]+$/)
  .example("ROLE_RPA_ADMIN");
