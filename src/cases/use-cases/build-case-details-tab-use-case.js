import Boom from "@hapi/boom";
import { JSONPath } from "jsonpath-plus";
import {
  buildBanner,
  buildTabLinks,
  createRootContext,
  resolveJSONPath,
  shouldRender,
} from "../../common/json.js";
import { findById } from "../repositories/case.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";

export const buildCaseDetailsTabUseCase = async (caseId, tabId) => {
  const kase = await findById(caseId);
  const workflow = await findByCode(kase.workflowCode);
  const root = createRootContext(kase, workflow);

  const tabDefinition = getTabDefinition({ root, workflow, tabId });
  if (!shouldRender(root, tabDefinition)) {
    throw Boom.notFound(
      `Should not render Case with id "${caseId}", ${tabDefinition?.renderIf} is ${resolveJSONPath({ root, path: tabDefinition?.renderIf })}`,
    );
  }

  const banner = buildBanner(kase, workflow);
  const links = buildTabLinks(kase, workflow);
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

const getTabDefinition = ({ workflow, tabId }) => {
  // TODO: check permissions!!!

  const [tabDefinition] = JSONPath({
    json: workflow,
    path: `$.pages.cases.details.tabs.${tabId}`,
  });

  if (!tabDefinition) {
    throw Boom.notFound(
      `Tab "${tabId}" not found in workflow "${workflow.code}"`,
    );
  }

  return tabDefinition;
};
