import Joi from "joi";

export const emailSchema = Joi.string().email().example("user@example.com");
