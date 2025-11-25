import Boom from "@hapi/boom";
import { createCaseWorkflowContext } from "../../common/build-view-model.js";
import { callAPIAndFetchData } from "../../common/external-action-service.js";
import { logger } from "../../common/logger.js";
import { findExternalAction } from "../../common/workflow-helpers.js";
import { findById, update } from "../repositories/case.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";

export const performPageActionUseCase = async ({ caseId, actionCode }) => {
  const kase = await loadCase(caseId);
  const workflow = await loadWorkflow(kase.workflowCode);
  const externalAction = validateExternalAction(actionCode, workflow);

  const caseWorkflowContext = createCaseWorkflowContext(kase, workflow);

  logger.info(
    { caseId, actionCode },
    `Performing page action: ${actionCode} for case: ${caseId}`,
  );

  const response = await callAPIAndFetchData({
    actionValue: actionCode,
    caseWorkflowContext,
    throwOnError: true,
  });

  await storeResponseIfNeeded(
    kase,
    externalAction,
    response,
    caseId,
    actionCode,
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
  const externalAction = findExternalAction(actionCode, workflow);

  if (!externalAction) {
    throw Boom.notFound(`External action not found: ${actionCode}`);
  }

  return externalAction;
};

const storeResponseIfNeeded = async (
  kase,
  externalAction,
  response,
  caseId,
  actionCode,
) => {
  if (shouldStoreResponse(externalAction, response)) {
    storeResponseInSupplementaryData(kase, externalAction, response);
    await update(kase);
    logger.info(
      { caseId, actionCode, target: externalAction.target },
      `Successfully stored response in supplementaryData for action: ${actionCode}`,
    );
  }
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
