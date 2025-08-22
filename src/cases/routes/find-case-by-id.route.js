import Joi from "joi";
import { findCaseByIdUseCase } from "../use-cases/find-case-by-id.use-case.js";

export const findCaseByIdRoute = {
  method: "GET",
  path: "/cases/{caseId}",
  options: {
    description: "Find a case by id",
    tags: ["api"],
    validate: {
      params: Joi.object({
        caseId: Joi.string().hex().length(24),
      }),
    },
    // response: {
    //   schema: findCaseResponseSchema,
    // },
  },
  async handler(request) {
    const { caseId } = request.params;

    const result = await findCaseByIdUseCase(caseId);

    return result;
  },
};
