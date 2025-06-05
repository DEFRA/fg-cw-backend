import { caseService } from "../services/case.service.js";

export const eventController = async (request, h) => {
  return h
    .response(await caseService.handleCreateCaseEvent(request.payload))
    .code(201);
};
