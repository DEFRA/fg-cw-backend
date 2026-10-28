import Joi from "joi";

export const nameSchema = Joi.string().min(2).max(300).example("Casey Test");
