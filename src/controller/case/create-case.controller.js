import { createCaseUseCase } from "../../use-case/case/create-case.use-case.js";

export const caseCreateController = async (request, h) => {
  console.log("the payload===", request.payload);
  await createCaseUseCase(request.payload);
  return h.response({}).code(201);
};
