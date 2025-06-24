import Joi from "joi";

export const firstNameSchema = Joi.string().min(1).max(300).example("John");
