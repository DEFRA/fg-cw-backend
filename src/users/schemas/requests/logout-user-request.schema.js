import Joi from "joi";

export const logoutUserRequestSchema = Joi.object({
  userId: Joi.string()
    .hex()
    .length(24)
    .required()
    .example("507f1f77bcf86cd799439011"),
})
  .options({
    stripUnknown: true,
  })
  .label("LogoutUserRequest");
