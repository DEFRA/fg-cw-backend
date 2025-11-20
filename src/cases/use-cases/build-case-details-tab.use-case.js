import Boom from "@hapi/boom";
import { readFileSync } from "fs";
import { JSONPath } from "jsonpath-plus";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
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

export const buildCaseDetailsTabUseCase = async (request) => {
  // TODO: check permissions!!!

  const { caseId, tabId } = request.params;

  const kase = await findById(caseId);
  const workflow = await findByCode(kase.workflowCode);

  const root = await createRootContext({ kase, workflow, request, tabId });

  const [banner, links, content] = await Promise.all([
    buildBanner(root),
    buildLinks(root),
    buildContent(root),
  ]);

  return {
    caseId,
    caseRef: kase.caseRef,
    tabId,
    banner,
    links,
    content,
  };
};

export const createRootContext = async ({ kase, workflow, request, tabId }) => {
  const caseWorkflowContext = createCaseWorkflowContext(
    kase,
    workflow,
    request,
  );

  const tabDefinition = await getTabDefinition({
    root: caseWorkflowContext,
    tabId,
  });

  const actionContext = await getActionContext({
    tabDefinition,
    caseWorkflowContext,
  });

  return {
    ...caseWorkflowContext,
    tabDefinition,
    actionData: actionContext,
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
    const actionValue = tabDefinition.action[key];
    actionData[key] = await callAPIAndFetchData({
      actionValue,
      caseWorkflowContext,
    });
  }
  return actionData;
};

const callAPIAndFetchData = async ({ actionValue, caseWorkflowContext }) => {
  try {
    const params = await extractEndpointParameters({
      actionValue,
      caseWorkflowContext,
    });

    // TODO: This is temporary until we are calling the Rules Engine API to fetch this data!
    if (params.runId) {
      return await loadRulesRunData(params.runId);
    }

    return await loadDefaultRulesData();
  } catch (error) {
    logger.error(
      {
        error,
        actionValue,
      },
      `Failed to fetch data for action ${actionValue}: ${error.message}`,
    );
    return [];
  }
};

const resolveParameterMap = async ({ paramMap, caseWorkflowContext }) => {
  const params = {};
  for (const [paramName, paramExpression] of Object.entries(paramMap)) {
    params[paramName] = await resolveJSONPath({
      root: caseWorkflowContext,
      path: paramExpression,
    });
  }
  return params;
};

// eslint-disable-next-line complexity
const extractEndpointParameters = async ({
  actionValue,
  caseWorkflowContext,
}) => {
  const externalAction = findExternalAction(
    actionValue,
    caseWorkflowContext.workflow,
  );

  if (!externalAction?.endpoint?.endpointParams) {
    return {};
  }

  const allParams = {};

  for (const [, paramMap] of Object.entries(
    externalAction.endpoint.endpointParams,
  )) {
    const resolvedParams = await resolveParameterMap({
      paramMap,
      caseWorkflowContext,
    });
    Object.assign(allParams, resolvedParams);
  }

  return allParams;
};

const findExternalAction = (actionValue, workflow) => {
  if (typeof actionValue !== "string" || !workflow.externalActions) {
    return null;
  }

  return workflow.externalActions.find((action) => action.code === actionValue);
};

const buildContent = async (root) => {
  return await resolveJSONPath({
    root,
    path: root.tabDefinition.content,
  });
};

// TODO: Temporary - will be removed when we start calling the Rules Engine API
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const __outputPath = join(__dirname, "./temp-rules-engine-output");

const loadRulesRunData = async (runId) => {
  // TODO: Temporary - will be replaced with API call to Rules Engine
  // For now, load from local fixture files
  const filePath = join(__outputPath, `rules-run-${runId}.json`);
  return JSON.parse(readFileSync(filePath, "utf-8"));
};

const loadDefaultRulesData = async () => {
  // TODO: Temporary - will be replaced with API call to Rules Engine
  const filePath = join(__outputPath, `rules-run-default.json`);
  return JSON.parse(readFileSync(filePath, "utf-8"));
};
