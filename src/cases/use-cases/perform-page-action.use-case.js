import Boom from "@hapi/boom";
import { createCaseWorkflowContext } from "../../common/build-view-model.js";
import { logger } from "../../common/logger.js";
import { findById, update } from "../repositories/case.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";
import { externalActionUseCase } from "./external-action.use-case.js";

export const performPageActionUseCase = async ({
  caseId,
  actionCode,
  user,
}) => {
  const kase = await loadCase(caseId);
  const workflow = await loadWorkflow(kase.workflowCode);
  const externalAction = validateExternalAction(actionCode, workflow);
  const caseWorkflowContext = createCaseWorkflowContext({ kase, workflow });

  logger.info(`Performing page action: ${actionCode} for case: ${caseId}`);

  const response = await externalActionUseCase({
    actionCode,
    caseWorkflowContext,
    throwOnError: true,
  });

  let caseUpdated = false;

  if (shouldStoreResponse(externalAction, response)) {
    storeResponseInSupplementaryData(kase, externalAction, response);
    caseUpdated = true;
    logger.debug(
      `Successfully stored response in supplementaryData for action: ${actionCode} for case: ${caseId}`,
    );
  }

  if (externalAction.display === true) {
    kase.addExternalActionTimelineEvent({
      actionName: externalAction.name,
      createdBy: user.id,
    });
    caseUpdated = true;
  }

  if (caseUpdated) {
    await update(kase);
  }

  logger.info(
    `Finished: Performing page action: ${actionCode} for case: ${caseId}`,
  );

  return response;
};

const loadCase = async (caseId) => {
  const kase = await findById(caseId);

  if (!kase) {
    throw Boom.notFound(`Case not found: ${caseId}`);
  }

  return kase;
};

const loadWorkflow = async (workflowCode) => {
  const workflow = await findByCode(workflowCode);

  if (!workflow) {
    throw Boom.notFound(`Workflow not found: ${workflowCode}`);
  }

  return workflow;
};

const validateExternalAction = (actionCode, workflow) => {
  const externalAction = workflow.findExternalAction(actionCode);

  if (!externalAction) {
    throw Boom.notFound(`External action not found: ${actionCode}`);
  }

  return externalAction;
};

const shouldStoreResponse = (externalAction, response) => {
  return externalAction.target && response && Object.keys(response).length > 0;
};

const storeResponseInSupplementaryData = (kase, externalAction, response) => {
  const { target } = externalAction;

  kase.updateSupplementaryData({
    targetNode: target.targetNode,
    dataType: target.dataType,
    key: target.key,
    data: response,
  });
};
