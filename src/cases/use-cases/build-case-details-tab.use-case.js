import Boom from "@hapi/boom";
import { JSONPath } from "jsonpath-plus";
import { buildDynamicContent } from "../../common/build-dynamic-content.js";
import {
  assertPathExists,
  buildBanner,
  buildLinks,
  createRootContext,
} from "../../common/build-view-model.js";
import { logger } from "../../common/logger.js";
import { resolveJSONPath } from "../../common/resolve-json.js";
import { findById } from "../repositories/case.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";

export const buildCaseDetailsTabUseCase = async (caseId, tabId) => {
  // TODO: check permissions!!!

  const kase = await findById(caseId);
  const workflow = await findByCode(kase.workflowCode);

  logger.debug(
    {
      caseId,
      caseRef: kase.caseRef,
      workflowCode: workflow.code,
      tabId,
    },
    "Case and workflow retrieved",
  );

  const root = createRootContext(kase, workflow);

  const tabDefinition = getTabDefinition({ root, workflow, tabId });
  logger.debug(
    {
      caseId,
      tabId,
      hasTabDefinition: !!tabDefinition,
      hasRenderIf: !!tabDefinition.renderIf,
    },
    "Tab definition retrieved",
  );

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
    logger.debug(
      {
        tabId,
        renderIfPath: tabDefinition.renderIf,
      },
      "RenderIf path validated successfully",
    );
  }

  return tabDefinition;
};

const handleMissingTabDefinition = ({ root, workflow, tabId }) => {
  if (tabId === "case-details") {
    logger.debug(
      {
        workflowCode: workflow.code,
      },
      "Building dynamic content for case-details tab",
    );
    return {
      content: buildDynamicContent(root.payload),
    };
  }

  throw Boom.notFound(
    `Tab "${tabId}" not found in workflow "${workflow.code}"`,
  );
};
