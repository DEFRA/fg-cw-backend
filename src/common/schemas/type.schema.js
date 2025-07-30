import Joi from "joi";

export const typeSchema = Joi.string()
  .valid("string", "number", "boolean", "date", "object", "array")
  .required();
