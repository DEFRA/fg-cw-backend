import Joi from "joi";

export const codeSchema = Joi.string()
  .pattern(/^[A-Z0-9][A-Z0-9_]*$/)
  .example("RPA_ADMIN");
