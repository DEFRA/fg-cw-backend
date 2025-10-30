import { config } from "../../common/config.js";
import { withTransaction } from "../../common/with-transaction.js";
import { CaseStatusUpdatedEvent } from "../events/case-status-updated.event.js";
import { Case } from "../models/case.js";
import { Outbox } from "../models/outbox.js";
import { save } from "../repositories/case.repository.js";
import { insertMany } from "../repositories/outbox.repository.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

const caseStatus = {
  NEW: "NEW",
  IN_PROGRESS: "IN_PROGRESS",
};

export const createCaseUseCase = async ({ caseRef, workflowCode, payload }) => {
  return await withTransaction(async (session) => {
    const workflow = await findWorkflowByCodeUseCase(workflowCode);

    const kase = Case.new({
      caseRef,
      payload,
      workflow,
    });

    await save(kase, session);

    // FGP-659 - send event back to GAS to update the status to IN_PROGRESS
    // This can be removed when we have state transitions in CW-BE
    const caseStatusEvent = new CaseStatusUpdatedEvent({
      caseRef,
      workflowCode,
      previousStatus: caseStatus.NEW,
      currentStatus: caseStatus.IN_PROGRESS,
    });

    await insertMany(
      [
        new Outbox({
          event: caseStatusEvent,
          target: config.get("aws.sns.caseStatusUpdatedTopicArn"),
        }),
      ],
      session,
    );
  });
};
