import Joi from "joi";

export const lastNameSchema = Joi.string().max(300);
