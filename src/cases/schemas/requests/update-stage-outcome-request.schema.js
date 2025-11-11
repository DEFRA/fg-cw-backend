import Joi from "joi";

export const updateStageOutcomeRequestSchema = Joi.object({
  actionCode: Joi.string().required(),
  comment: Joi.string().allow("", null).optional(),
})
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("UpdateStageOutcomeRequestSchema");
