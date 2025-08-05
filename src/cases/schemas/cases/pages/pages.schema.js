import Joi from "joi";

const fieldSchema = Joi.object({
  ref: Joi.string().required(),
  type: Joi.string().valid("string", "number", "boolean", "date").required(),
  label: Joi.string().required(),
  format: Joi.string().optional(),
});

const sectionSchema = Joi.object({
  title: Joi.string().required(),
  type: Joi.string().valid("object", "array").required(),
  component: Joi.string().valid("list", "table").required(),
  fields: Joi.array().items(fieldSchema).required(),
});

const tabSchema = Joi.object({
  title: Joi.string().required(),
  sections: Joi.array().items(sectionSchema).required(),
});

const bannerSummarySchema = Joi.object().pattern(
  Joi.string(),
  Joi.object({
    label: Joi.string().required(),
    ref: Joi.string().required(),
    type: Joi.string().valid("string", "number", "boolean", "date").required(),
  }),
);

const bannerSchema = Joi.object({
  title: Joi.object({
    ref: Joi.string().required(),
    type: Joi.string().valid("string", "number", "boolean", "date").required(),
  }).required(),
  summary: bannerSummarySchema.required(),
});

const detailsSchema = Joi.object({
  banner: bannerSchema.required(),
  tabs: Joi.object().pattern(Joi.string(), tabSchema).required(),
});

const pagesSchema = Joi.object({
  details: detailsSchema.required(),
});

export { pagesSchema };
