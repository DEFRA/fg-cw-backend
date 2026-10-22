import Joi from "joi";
import { WorkflowDefinitionFetch } from "../../cases/models/workflow-definition-fetch.js";

// Lenient, so a legacy or odd row cannot turn a debugging read into a 500.
const nullableString = Joi.string().allow(null);
const nullableIso = Joi.string().isoDate().allow(null);

const versionEntry = {
  version: Joi.string().required(),
  status: Joi.string().required(),
  receivedAt: nullableIso.required(),
  fetchStatus: nullableString.required(),
  // Whether the workflow is in the workflows collection, however it got there.
  stored: Joi.boolean().required(),
};

// Newest first.
const versions = Joi.array()
  .items(Joi.object(versionEntry).label("WorkflowVersionEntry"))
  .required();

// The newest active version, or null when there is none.
const current = nullableString.required();

const roles = Joi.array().items(Joi.string()).required();

const summary = Joi.object({
  schemeName: nullableString.required(),
  requiredRoles: Joi.object({ allOf: roles, anyOf: roles }).required(),
}).label("WorkflowSummary");

// Where one endpoint resolves to here: never headers, user info, query or
// fragment.
const address = Joi.object({
  code: nullableString.required(),
  service: nullableString.required(),
  url: nullableString.required(),
}).label("WorkflowEndpointAddress");

export const workflowVersionsResponseSchema = Joi.object({
  code: Joi.string().required(),
  current,
  versions,
}).label("WorkflowVersionsResponse");

export const workflowVersionResponseSchema = Joi.object({
  version: Joi.object({
    grantCode: Joi.string().required(),
    ...versionEntry,
    fetchError: nullableString.required(),
    fetchAttempts: Joi.number().integer().min(0).required(),
    s3Key: nullableString.required(),
    s3Bucket: nullableString.required(),
  })
    .required()
    .label("WorkflowConfigVersion"),
  versions,
  current,
  storedBytes: Joi.number().integer().min(0).allow(null).required(),
  summary: summary.allow(null).required(),
  // Returned whole and never validated inside: the stored workflow as it is.
  document: Joi.any(),
  // One per endpoint, in the workflow's endpoint order.
  addresses: Joi.array().items(address),
}).label("WorkflowVersionResponse");

export const workflowDefinitionFetchResponseSchema = Joi.object({
  files: Joi.array().items(WorkflowDefinitionFetch.validationSchema).required(),
}).label("WorkflowDefinitionFetchResponse");

export const workflowVersionExistenceResponseSchema = Joi.object({
  exists: Joi.boolean().required(),
}).label("WorkflowVersionExistenceResponse");
