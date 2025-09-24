import Boom from "@hapi/boom";
import { JSONPath } from "jsonpath-plus";
import { buildDynamicContent } from "../../common/build-dynamic-content.js";
import {
  assertPathExists,
  buildBanner,
  buildLinks,
  createRootContext,
} from "../../common/build-view-model.js";
import { resolveJSONPath } from "../../common/resolve-json.js";
import { findById } from "../repositories/case.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";

export const buildCaseDetailsTabUseCase = async (caseId, tabId) => {
  // TODO: check permissions!!!

  const kase = await findById(caseId);
  const workflow = await findByCode(kase.workflowCode);

  const root = createRootContext(kase, workflow);
  const tabDefinition = getTabDefinition({ root, workflow, tabId });
  const banner = buildBanner(kase, workflow);
  const links = buildLinks(kase, workflow);
  const content = resolveJSONPath({ root, path: tabDefinition.content });

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
