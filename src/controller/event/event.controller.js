import { caseUseCase } from "../../use-case/case/case.use-case.js";

export const eventController = async (request, h) => {
  return h
    .response(await caseUseCase.handleCreateCaseEvent(request.payload))
    .code(201);
};
