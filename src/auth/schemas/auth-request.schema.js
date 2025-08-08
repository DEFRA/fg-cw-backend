import Joi from "joi";

export const authTokenRequestSchema = Joi.object({
  accessToken: Joi.string(),
  })
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("AuthTokenRequest");
