import Joi from "joi";

export const addNoteToCaseRequestSchema = Joi.object({
  type: Joi.string().required(),
  content: Joi.string().required(),
})
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("AssignUserToCaseRequestSchema");
