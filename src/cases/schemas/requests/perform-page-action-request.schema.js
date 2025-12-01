import Joi from "joi";

export const performPageActionRequestSchema = Joi.object({
  actionCode: Joi.string().required(),
}).label("PerformPageActionRequest");
