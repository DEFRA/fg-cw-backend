import Joi from "joi";

// Only immutable submitted values form group identity. No executable expression DSL.
const path = Joi.string()
  .pattern(/^\$case\.(payload\.[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)*|caseRef)$/)
  .custom((value, helpers) =>
    /(^|\.)(__proto__|constructor|prototype)(\.|$)/.test(value)
      ? helpers.error("any.invalid")
      : value,
  );
export const dedupeConfigurationSchema = Joi.object({
  scope: Joi.object({
    phase: Joi.string().required(),
    stage: Joi.string().required(),
    excludeStatuses: Joi.array().items(Joi.string()).required(),
  }).required(),
  groupBy: Joi.array()
    .items(
      Joi.object({
        name: Joi.string()
          .pattern(/^[a-zA-Z][\w]*$/)
          .invalid("constructor", "prototype", "__proto__"),
        label: Joi.string(),
        value: path.required(),
      }),
    )
    .min(1)
    .required(),
  display: Joi.object({ businessName: path.required() }).required(),
});
export const caseListSchema = Joi.object({
  tabs: Joi.object()
    .pattern(
      /^[a-zA-Z][\w-]*$/,
      Joi.object({
        title: Joi.string().required(),
        "page-type": Joi.object({
          type: Joi.string().valid("dedupe").required(),
          configuration: dedupeConfigurationSchema.required(),
        }).required(),
      }),
    )
    .required(),
});
