import Boom from "@hapi/boom";
import { JSONPath } from "jsonpath-plus";
import { buildDynamicContent } from "../../common/build-dynamic-content.js";
import {
  assertPathExists,
  buildBanner,
  buildLinks,
  createCaseWorkflowContext,
} from "../../common/build-view-model.js";
import { logger } from "../../common/logger.js";
import { resolveJSONPath } from "../../common/resolve-json.js";
import { findById } from "../repositories/case.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";
import { buildBeforeContent } from "./build-before-content.js";
import { externalActionUseCase } from "./external-action.use-case.js";

export const buildCaseDetailsTabUseCase = async (request) => {
  // TODO: check permissions!!!

  logger.info(
    `Building case details tab for case ${request.params.caseId} and tab ${request.params.tabId}`,
  );

  const { caseId, tabId } = request.params;
  const user = request.user ?? null;

  const kase = await findById(caseId);

  if (!kase) {
    throw Boom.notFound(`Case not found: ${caseId}`);
  }

  const workflow = await findByCode(kase.workflowCode);

  if (!workflow) {
    throw Boom.notFound(`Workflow not found: ${kase.workflowCode}`);
  }

  const root = await createRootContext({
    kase,
    workflow,
    request,
    tabId,
    user,
  });

  const workflowStage = workflow.getStage(kase.position);

  const [banner, links, content, beforeContent] = await Promise.all([
    buildBanner(root),
    buildLinks(root),
    buildContent(root),
    buildBeforeContent(workflowStage, root),
  ]);

  logger.info(
    `Finished: Building case details tab for case ${request.params.caseId} and tab ${request.params.tabId}`,
  );

  return {
    caseId,
    caseRef: kase.caseRef,
    tabId,
    banner,
    links,
    content,
    beforeContent,
  };
};

export const createRootContext = async ({
  kase,
  workflow,
  request,
  tabId,
  user,
}) => {
  const caseWorkflowContext = createCaseWorkflowContext({
    kase,
    workflow,
    request,
    user,
  });

  const tabDefinition = await getTabDefinition({
    root: caseWorkflowContext,
    tabId,
  });

  const actionData = await getActionContext({
    tabDefinition,
    caseWorkflowContext,
  });

  return {
    ...caseWorkflowContext,
    tabDefinition,
    actionData,
  };
};

const getTabDefinition = async ({ root, tabId }) => {
  const [tabDefinition] = JSONPath({
    json: root.workflow,
    path: `$.pages.cases.details.tabs.${tabId}`,
  });

  if (!tabDefinition) {
    return handleMissingTabDefinition({ root, tabId });
  }

  if (tabDefinition.renderIf) {
    await assertPathExists(root, tabDefinition.renderIf);
  }

  return tabDefinition;
};

const handleMissingTabDefinition = ({ root, tabId }) => {
  if (tabId === "case-details") {
    return {
      content: buildDynamicContent(root.payload),
    };
  }

  throw Boom.notFound(
    `Tab "${tabId}" not found in workflow "${root.workflow.code}"`,
  );
};

const getActionContext = async ({ tabDefinition, caseWorkflowContext }) => {
  if (!tabDefinition.action) {
    return {};
  }

  const actionData = {};
  for (const key of Object.keys(tabDefinition.action)) {
    const actionCode = tabDefinition.action[key];
    actionData[key] = await externalActionUseCase({
      actionCode,
      caseWorkflowContext,
    });
  }
  return actionData;
};

const buildContent = async (root) => {
  return await resolveJSONPath({
    root,
    path: root.tabDefinition.content,
  });
};
