import Joi from "joi";

export const ValidationError = Joi.object({
  statusCode: Joi.number().example(400),
  error: Joi.string().example("Bad Request"),
  message: Joi.string().example("Case id is required"),
  validation: Joi.object({
    keys: Joi.array().items(Joi.string().example("id")),
    source: Joi.string().example("payload"),
  }),
}).label("ValidationError");
