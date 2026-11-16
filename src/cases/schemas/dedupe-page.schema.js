import Joi from "joi";

// Only direct immutable submitted paths may be projected or used as identity.
export const caseDataPath = Joi.string()
  .pattern(/^\$case\.(payload\.[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)*|caseRef)$/)
  .custom((value, helpers) =>
    /(^|\.)(__proto__|constructor|prototype)(\.|$)/.test(value)
      ? helpers.error("any.invalid")
      : value,
  );
const scalar = Joi.alternatives()
  .try(Joi.string().allow(""), Joi.number(), Joi.boolean())
  .allow(null);
const fieldName = /^[a-zA-Z]\w*$/;
const fields = Joi.object().pattern(fieldName, scalar).min(1);
const statusMap = Joi.object({
  NOT_STARTED: Joi.string().required(),
  IN_PROGRESS: Joi.string().required(),
  COMPLETED: Joi.string().required(),
});
const component = Joi.object({
  component: Joi.string().valid("url", "hint", "text", "status").required(),
  text: Joi.string().allow("").required(),
  href: Joi.when("component", {
    is: "url",
    then: Joi.string().valid("@.groupHref").required(),
    otherwise: Joi.forbidden(),
  }),
  classes: Joi.string(),
  labelsMap: Joi.when("component", {
    is: "status",
    then: statusMap.required(),
    otherwise: Joi.forbidden(),
  }),
  classesMap: Joi.when("component", {
    is: "status",
    then: statusMap.required(),
    otherwise: Joi.forbidden(),
  }),
});
const components = Joi.array().items(component).min(1);
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
        value: caseDataPath.required(),
      }),
    )
    .min(1)
    .required(),
  data: Joi.object({
    details: fields.keys({ businessName: scalar.required() }).required(),
    assignee: fields.required(),
    status: fields.required(),
  }).required(),
  columns: Joi.object({
    details: components.required(),
    assignee: components.required(),
    status: components.required(),
  }).required(),
  sort: Joi.array()
    .items(
      Joi.object({
        value: Joi.string().required(),
        order: Joi.string().valid("ascending", "descending").required(),
      }),
    )
    .min(1)
    .required(),
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
