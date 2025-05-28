import { createCaseUseCase } from "../../use-case/case/create-case.use-case.js";

export const caseCreateController = async (request, h) => {
  await createCaseUseCase(request.payload);
  return h.response({}).code(201);
};
