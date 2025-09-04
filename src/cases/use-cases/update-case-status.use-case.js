import Boom from "@hapi/boom";

import { getAuthenticatedUser } from "../../common/auth.js";
import { publishCaseStatusUpdated } from "../publishers/case-event.publisher.js";
import { findById, update } from "../repositories/case.repository.js";

export const updateCaseStatusUseCase = async ({ caseId, status }) => {
  const kase = await findById(caseId);

  if (!kase) {
    throw Boom.notFound(`Case with id "${caseId}" not found`);
  }

  const createdBy = getAuthenticatedUser().id;

  kase.updateStatus(status, createdBy);

  await update(kase);

  await publishCaseStatusUpdated({
    caseRef: kase.caseRef,
    previousStatus: kase.previousStatus,
    currentStatus: kase.currentStatus,
  });
};
