import Joi from "joi";

export const addNoteToCaseRequestSchema = Joi.object({
  text: Joi.string().required(),
})
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("AddNoteToCaseRequestSchema");
