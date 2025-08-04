import Joi from "joi";

export const idSchema = Joi.string().hex().length(24);
