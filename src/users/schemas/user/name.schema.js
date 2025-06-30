import Joi from "joi";

export const nameSchema = Joi.string().min(1).max(300).example("Bob Bill");
