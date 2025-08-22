import Joi from "joi";

export const updateStageOutcomeRequestSchema = Joi.object({
  actionId: Joi.string().required(),
  comment: Joi.string().optional(),
})
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("UpdateStageOutcomeRequestSchema");
