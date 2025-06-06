import Joi from "joi";
import { extractListQuery } from "../../common/extract-list-query.js";
import { ListResponse } from "../schemas/common.schema.js";
import { findCasesUseCase } from "../use-cases/find-cases.use-case.js";

export const findCasesRoute = {
  method: "GET",
  path: "/cases",
  options: {
    description: "Find all cases",
    tags: ["api"],
    validate: {
      query: Joi.object({
        page: Joi.number().integer().optional(),
        pageSize: Joi.number().integer().optional(),
      }),
    },
    response: {
      schema: ListResponse,
    },
  },
  async handler(request) {
    const listQuery = extractListQuery(request);

    const results = await findCasesUseCase(listQuery);

    return results;
  },
};
