import Joi from "joi";
import { UrlSafeId } from "../url-safe-id.schema.js";
import { bannerSchema } from "../workflow.schema.js";

const schemaComponent = Joi.object({
  id: Joi.string().optional(),
  component: Joi.string().optional(),
})
  .unknown()
  .label("Component");

const schemaLink = Joi.object({
  id: UrlSafeId.required(),
  href: Joi.string().required(),
  text: Joi.string().required(),
  index: Joi.number().optional(),
}).label("Link");

export const findCaseByIdTabIdResponseSchema = Joi.object({
  caseId: Joi.string().hex().length(24).required(),
  caseRef: Joi.string().required(),
  tabId: UrlSafeId.required(),
  banner: bannerSchema.required(),
  links: Joi.array().items(schemaLink).min(1).required(),
  content: Joi.array().items(schemaComponent).required(),
})
  .options({
    presence: "required",
    stripUnknown: true,
  })
  .label("FindCaseByIdTabIdResponse");
