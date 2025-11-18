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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// TODO: Temporary - will be replaced with API call to Rules Engine
const rulesEngineOutput = JSON.parse(
  readFileSync(join(__dirname, "./temp-rules-engine-output.json"), "utf-8"),
);

export const buildCaseDetailsTabUseCase = async (caseId, tabId) => {
  // TODO: check permissions!!!

  const kase = await findById(caseId);
  const workflow = await findByCode(kase.workflowCode);

  const caseWorkflowContext = createCaseWorkflowContext(kase, workflow);
  const tabDefinition = getTabDefinition({
    root: caseWorkflowContext,
    workflow,
    tabId,
  });

  const actionContext = await getActionContext(tabDefinition);

  const root = { ...caseWorkflowContext, actionData: { ...actionContext } };

  const banner = buildBanner(kase, workflow);
  const links = buildLinks(kase, workflow);
  const content = resolveJSONPath({
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

const getTabDefinition = ({ root, workflow, tabId }) => {
  const [tabDefinition] = JSONPath({
    json: workflow,
    path: `$.pages.cases.details.tabs.${tabId}`,
  });

  if (!tabDefinition) {
    return handleMissingTabDefinition({ root, workflow, tabId });
  }

  if (tabDefinition.renderIf) {
    assertPathExists(root, tabDefinition.renderIf);
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

const getActionContext = async (tabDefinition) => {
  if (!tabDefinition.action) {
    return {};
  }
  const actionData = {};
  for (const key of Object.keys(tabDefinition.action)) {
    actionData[key] = await callAPIAndFetchData();
  }
  return actionData;
};

const callAPIAndFetchData = async () => {
  // TODO: This is temporary until we are calling the Rules Engine API to fetch this data!
  return rulesEngineOutput;
};
