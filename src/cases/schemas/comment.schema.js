import Joi from "joi";

export const commentSchema = Joi.object({
  label: Joi.string().required(),
  helpText: Joi.string().optional(),
  type: Joi.string().valid("REQUIRED", "OPTIONAL").required(),
}).label("Comment");
