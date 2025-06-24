import Joi from "joi";

export const lastNameSchema = Joi.string().min(1).max(300).example("Smith");
