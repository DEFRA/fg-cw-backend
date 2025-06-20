import Joi from "joi";

export const idpIdSchema = Joi.string()
  .uuid()
  .example("123e4567-e89b-12d3-a456-426614174000");
