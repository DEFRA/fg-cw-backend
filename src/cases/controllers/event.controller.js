import { caseService } from "../services/case.service.js";

export const eventController = async (request, h) => {
  await caseService.handleCreateCaseEvent(request.payload);
  return h.response().code(201);
};
