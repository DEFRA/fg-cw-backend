import { findCasesResponseSchema } from "../schemas/responses/find-cases-response.schema.js";
import { findCasesUseCase } from "../use-cases/find-cases.use-case.js";

export const findCasesRoute = {
  method: "GET",
  path: "/cases",
  options: {
    description: "Find all cases",
    tags: ["api"],
    response: {
      schema: findCasesResponseSchema,
    },
  },
  async handler() {
    const results = await findCasesUseCase();

    return results;
  },
};
