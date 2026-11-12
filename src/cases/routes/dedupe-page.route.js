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
  keyHash: Joi.string().hex().length(64).required(),
});
const label = Joi.object({
  code: Joi.string().required(),
  data: Joi.object({ duplicateOf: Joi.string() }).allow(null),
}).allow(null);
const base = "/case-types/{caseType}/pages/{pageKey}";
const handler = (useCase) => (request) =>
  useCase({
    ...request.params,
    user: request.auth.credentials.user,
    payload: request.payload,
  });
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
    path: `${base}/groups/{keyHash}`,
    handler: handler(viewDedupeGroupUseCase),
    options: {
      tags: ["api"],
      description: "View a dedupe group",
      validate: { params: groupIdentity },
    },
  },
  {
    method: "PUT",
    path: `${base}/groups/{keyHash}`,
    handler: handler(saveDedupeGroupUseCase),
    options: {
      tags: ["api"],
      description: "Save group owner and case labels",
      validate: {
        params: groupIdentity,
        payload: Joi.object({
          assignee: Joi.string().hex().length(24).allow(null).required(),
          labels: Joi.object()
            .pattern(/^[\w-]+$/, label)
            .required(),
        }),
      },
    },
  },
];
