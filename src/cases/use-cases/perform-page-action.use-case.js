import Boom from "@hapi/boom";
import { AccessControl } from "../../common/access-control.js";
import {
  auditActions,
  auditEntities,
  buildAuditSecurity,
} from "../../common/audit-constants.js";
import { buildSecurityContext } from "../../common/audit-security-context.js";
import { createCaseWorkflowContext } from "../../common/build-view-model.js";
import { logger } from "../../common/logger.js";
import { withAudit } from "../../common/with-audit.js";
import { IdpRoles } from "../../users/models/idp-roles.js";
import {
  SUPPLEMENTARY_DATA_CONFLICT,
  update,
} from "../repositories/case.repository.js";
import { externalActionUseCase } from "./external-action.use-case.js";
import { loadCase } from "./load-case.js";
import {
  persistResolvedVersion,
  resolveWorkflowForCase,
} from "./resolve-current-workflow.use-case.js";

const MAX_UPDATE_ATTEMPTS = 3;

const applyResponseEffects = (
  kase,
  externalAction,
  response,
  actionCode,
  caseId,
  user,
) => {
  let caseUpdated = false;

  if (shouldStoreResponse(externalAction, response)) {
    storeResponseInSupplementaryData(kase, externalAction, response);
    caseUpdated = true;
    logger.debug(
      `Successfully stored response in supplementaryData for action: "${actionCode}" for case: "${caseId}"`,
    );
  }

  if (externalAction.display === true) {
    kase.addExternalActionTimelineEvent({
      actionName: externalAction.name,
      createdBy: user.id,
    });
    caseUpdated = true;
  }

  return caseUpdated;
};

const shouldRetryResponseSave = (error, remainingAttempts) =>
  error.data === SUPPLEMENTARY_DATA_CONFLICT && remainingAttempts > 1;

const persistResponseEffects = async (
  kase,
  externalAction,
  response,
  command,
  remainingAttempts,
) => {
  const { actionCode, caseId, user } = command;

  if (
    !applyResponseEffects(
      kase,
      externalAction,
      response,
      actionCode,
      caseId,
      user,
    )
  ) {
    return;
  }

  try {
    await update(kase);
  } catch (error) {
    if (!shouldRetryResponseSave(error, remainingAttempts)) {
      throw error;
    }
    const latestCase = await loadCase(command);
    await persistResponseEffects(
      latestCase,
      externalAction,
      response,
      command,
      remainingAttempts - 1,
    );
  }
};

const performPageAction = async (command) => {
  const { caseId, actionCode, user } = command;
  const kase = await loadCase(command);
  const { workflow, resolvedVersion } = await resolveWorkflowForCase(kase);
  await persistResolvedVersion(kase, resolvedVersion);

  if (!workflow) {
    throw Boom.notFound(`Workflow not found: ${kase.workflowCode}`);
  }

  AccessControl.authorise(user, {
    idpRoles: [IdpRoles.ReadWrite],
    appRoles: workflow.requiredRoles,
  });

  const externalAction = validateExternalAction(actionCode, workflow);
  const caseWorkflowContext = createCaseWorkflowContext({
    kase,
    workflow,
    user,
  });

  logger.info(`Performing page action: "${actionCode}" for case: "${caseId}"`);

  const response = await externalActionUseCase({
    actionCode,
    caseWorkflowContext,
    throwOnError: true,
  });

  await persistResponseEffects(
    kase,
    externalAction,
    response,
    command,
    MAX_UPDATE_ATTEMPTS,
  );

  logger.info(
    `Finished: Performing page action: "${actionCode}" for case: "${caseId}"`,
  );

  return response;
};

export const performPageActionAuditDataBuilder = ([command]) => ({
  entities: [
    {
      entity: auditEntities.CASE,
      action: auditActions.PERFORM_PAGE_ACTION,
      entityid: command.caseRef ?? command.caseId,
    },
  ],
  details: {
    security: buildSecurityContext(command.user),
    action: { actionCode: command.actionCode },
  },
  security: buildAuditSecurity(auditActions.PERFORM_PAGE_ACTION),
  segregationRef: `perform-page-action-${command.caseId}`,
});

export const performPageActionUseCase = withAudit(
  performPageAction,
  performPageActionAuditDataBuilder,
);

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
