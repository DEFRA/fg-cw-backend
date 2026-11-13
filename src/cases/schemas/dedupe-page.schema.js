import Joi from "joi";

const path = Joi.string().pattern(
  /^\$case\.(payload\.[\w.]+|caseRef|currentStatus)$/,
);
const option = Joi.object({
  code: Joi.string()
    .pattern(/^[A-Z_]+$/)
    .required(),
  text: Joi.string().required(),
  data: Joi.object({
    duplicateOf: Joi.object({
      required: Joi.boolean().valid(true).required(),
      oneOf: Joi.string().valid("activeGroupCases").required(),
    }).required(),
  }),
});
export const dedupeConfigurationSchema = Joi.object({
  scope: Joi.object({
    phase: Joi.string().required(),
    stage: Joi.string().required(),
    excludeStatuses: Joi.array().items(Joi.string()).required(),
  }).required(),
  groupBy: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().pattern(/^[a-zA-Z][\w]*$/),
        value: path.required(),
      }),
    )
    .min(1)
    .required(),
  sort: Joi.array()
    .items(
      Joi.object({
        value: Joi.string().required(),
        order: Joi.string().valid("ascending", "descending").required(),
      }),
    )
    .default([]),
  labels: Joi.object({
    namespace: Joi.string()
      .pattern(/^[a-zA-Z][\w-]*$/)
      .required(),
    options: Joi.array().items(option).min(1).unique("code").required(),
  }).required(),
  data: Joi.object().required(),
  columns: Joi.object().required(),
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
