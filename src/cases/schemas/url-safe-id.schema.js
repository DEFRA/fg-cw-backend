import Joi from "joi";

export const UrlSafeId = Joi.string()
  .pattern(/^[a-z0-9-]+$/)
  .label("UrlSafeId");
