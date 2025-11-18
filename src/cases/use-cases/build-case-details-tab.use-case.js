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
import { resolveJSONPath } from "../../common/resolve-json.js";
import { findById } from "../repositories/case.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";

export const buildCaseDetailsTabUseCase = async (request) => {
  // TODO: check permissions!!!

  const { caseId, tabId } = request.params;

  const kase = await findById(caseId);
  const workflow = await findByCode(kase.workflowCode);

  const caseWorkflowContext = createCaseWorkflowContext(
    kase,
    workflow,
    request,
  );

  const tabDefinition = await getTabDefinition({
    root: caseWorkflowContext,
    workflow,
    tabId,
  });

  const actionContext = await getActionContext({
    tabDefinition,
    workflow,
    caseWorkflowContext,
  });

  const root = { ...caseWorkflowContext, actionData: { ...actionContext } };

  const banner = await buildBanner(kase, workflow);
  const links = await buildLinks(kase, workflow);
  const content = await resolveJSONPath({
    root,
    path: tabDefinition.content,
  });

  return {
    caseId,
    caseRef: kase.caseRef,
    tabId,
    banner,
    links,
    content,
  };
};

const getTabDefinition = async ({ root, workflow, tabId }) => {
  const [tabDefinition] = JSONPath({
    json: workflow,
    path: `$.pages.cases.details.tabs.${tabId}`,
  });

  if (!tabDefinition) {
    return handleMissingTabDefinition({ root, workflow, tabId });
  }

  if (tabDefinition.renderIf) {
    await assertPathExists(root, tabDefinition.renderIf);
  }

  return tabDefinition;
};

const handleMissingTabDefinition = ({ root, workflow, tabId }) => {
  if (tabId === "case-details") {
    return {
      content: buildDynamicContent(root.payload),
    };
  }

  throw Boom.notFound(
    `Tab "${tabId}" not found in workflow "${workflow.code}"`,
  );
};

const getActionContext = async ({
  tabDefinition,
  workflow,
  caseWorkflowContext,
}) => {
  if (!tabDefinition.action) {
    return {};
  }
  const actionData = {};
  for (const key of Object.keys(tabDefinition.action)) {
    const actionValue = tabDefinition.action[key];
    actionData[key] = await callAPIAndFetchData({
      actionValue,
      workflow,
      caseWorkflowContext,
    });
  }
  return actionData;
};

const callAPIAndFetchData = async ({
  actionValue,
  workflow,
  caseWorkflowContext,
}) => {
  const params = await extractEndpointParameters({
    actionValue,
    workflow,
    caseWorkflowContext,
  });

  // TODO: This is temporary until we are calling the Rules Engine API to fetch this data!
  if (params.runId) {
    return await loadRulesRunData(params.runId);
  }

  return await loadDefaultRulesData();
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
  workflow,
  caseWorkflowContext,
}) => {
  const externalAction = findExternalAction(actionValue, workflow);

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
