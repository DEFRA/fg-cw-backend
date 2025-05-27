import { createCaseUseCase } from "../../use-case/case/create-case.use-case.js";

export const caseCreateController = async (request, h) => {
  console.log("the payload===", request.payload);
  return h.response(await createCaseUseCase(request.payload)).code(201);
};
