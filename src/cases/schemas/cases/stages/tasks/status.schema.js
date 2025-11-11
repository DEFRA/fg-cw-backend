import Joi from "joi";

export const statusSchema = Joi.string().allow(null);
