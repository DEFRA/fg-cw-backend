import Joi from "joi";
import { extractListQuery } from "../../common/extract-list-query.js";
import { commonSchema } from "../schemas/common.schema.js";
import { findWorkflowsUseCase } from "../use-cases/find-workflows.use-case.js";

export const findWorkflowsRoute = {
  method: "GET",
  path: "/workflows",
  options: {
    description: "Find all workflows",
    tags: ["api"],
    validate: {
      query: Joi.object({
        page: Joi.number().integer(),
        pageSize: Joi.number().integer(),
      }),
    },
    response: {
      status: {
        200: commonSchema.ListResponse,
        400: commonSchema.ValidationError,
      },
    },
  },
  async handler(request) {
    const listQuery = extractListQuery(request);

    const results = await findWorkflowsUseCase(listQuery);

    return results;
  },
};
