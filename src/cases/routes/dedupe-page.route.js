import Joi from "joi";
import {
  listCasePagesUseCase,
  saveDedupeGroupUseCase,
  viewDedupeGroupUseCase,
  viewDedupeSummaryUseCase,
} from "../use-cases/dedupe-page.use-case.js";

const identity = {
  caseType: Joi.string()
    .pattern(/^[\w-]+$/)
    .required(),
  pageKey: Joi.string()
    .pattern(/^[\w-]+$/)
    .required(),
};
const groupIdentity = Joi.object({
  ...identity,
  groupKey: Joi.string()
    .pattern(/^[\w-]+$/)
    .max(2048)
    .required(),
});
const base = "/case-types/{caseType}/pages/{pageKey}";
const command = (request) => ({
  ...request.params,
  user: request.auth.credentials.user,
  payload: request.payload,
});
const handler = (useCase) => (request) => useCase(command(request));
export const dedupePageRoutes = [
  {
    method: "GET",
    path: "/case-list-pages",
    handler: handler(listCasePagesUseCase),
    options: { tags: ["api"], description: "Find configured case list pages" },
  },
  {
    method: "GET",
    path: base,
    handler: handler(viewDedupeSummaryUseCase),
    options: {
      tags: ["api"],
      description: "View configured dedupe summary",
      validate: { params: Joi.object(identity) },
    },
  },
  {
    method: "GET",
    path: `${base}/groups/{groupKey}`,
    handler: handler(viewDedupeGroupUseCase),
    options: {
      tags: ["api"],
      description: "View a dedupe group",
      validate: { params: groupIdentity },
    },
  },
  {
    method: "PUT",
    path: `${base}/groups/{groupKey}`,
    async handler(request, h) {
      const result = await saveDedupeGroupUseCase(command(request));
      return result.validationError ? h.response(result).code(400) : result;
    },
    options: {
      tags: ["api"],
      description: "Save group owner and fixed case labels",
      validate: {
        params: groupIdentity,
        payload: Joi.object({
          form: Joi.object({ assignee: Joi.string().allow("").required() })
            .pattern(/^label-[\w-]+$/, Joi.string().allow(""))
            .required(),
        }),
      },
    },
  },
];
