import Joi from "joi";

export const comment = Joi.object({
  label: Joi.alternatives()
    .try(
      Joi.string(),
      Joi.object({
        text: Joi.string().required(),
        classes: Joi.string().optional(),
      }),
    )
    .required(),
  helpText: Joi.string().required(),
  mandatory: Joi.boolean().required(),
}).label("Comment");
