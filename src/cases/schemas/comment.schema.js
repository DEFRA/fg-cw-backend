import Joi from "joi";

export const comment = Joi.object({
  label: Joi.string().required(),
  helpText: Joi.string().required(),
  type: Joi.string().valid("CONDITIONAL", "REQUIRED", "OPTIONAL"),
}).label("Comment");
