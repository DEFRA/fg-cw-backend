import Joi from "joi";

export const firstNameSchema = Joi.string().max(300);
