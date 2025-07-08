import Joi from "joi";

export const idSchema = Joi.string()
  .hex()
  .length(24)
  .example("60c72b2f9b1e8d001c8e4f5a");
