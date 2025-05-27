import { caseSchema } from "../../schema/case.schema.js";
import { commonSchema } from "../../schema/common.schema.js";
import { caseCreateController } from "../../controller/case/create-case.controller.js";

export const createCaseRoute = {
  method: "POST",
  path: "/cases",
  options: {
    description: "Temporary: Create a handlers",
    tags: ["api"],
    validate: {
      payload: caseSchema.CaseData
    },
    response: {
      status: {
        201: caseSchema.Case,
        400: commonSchema.ValidationError
      }
    }
  },
  handler: caseCreateController
};
