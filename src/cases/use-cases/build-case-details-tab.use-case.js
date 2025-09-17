import Boom from "@hapi/boom";
import { JSONPath } from "jsonpath-plus";
import {
  buildBanner,
  buildLinks,
  createRootContext,
  shouldRender,
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
    throw Boom.notFound(
      `Tab "${tabId}" not found in workflow "${workflow.code}"`,
    );
  }

  assertShouldRender({ root, tabDefinition, tabId });

  return tabDefinition;
};

const assertShouldRender = ({ root, tabDefinition, tabId }) => {
  if (!shouldRender(root, tabDefinition)) {
    throw Boom.notFound(
      `Tab "${tabId}" should not render: ${tabDefinition?.renderIf} resolves to falsy value`,
    );
  }
};
