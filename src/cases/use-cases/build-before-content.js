import { logger } from "../../common/logger.js";
import { resolveJSONPath } from "../../common/resolve-json.js";

const shouldRenderItem = async (item, caseWorkflowContext) => {
  if (!item.renderIf) {
    logger.info("[beforeContent] No renderIf condition, defaulting to true");
    return true;
  }

  return await resolveJSONPath({
    root: caseWorkflowContext,
    path: item.renderIf,
  });
};

const resolveContentItem = async (item, caseWorkflowContext) => {
  const content = await resolveJSONPath({
    root: caseWorkflowContext,
    path: item.content,
  });
  return Array.isArray(content) ? content : [content];
};

const processBeforeContentItem = async (item, caseWorkflowContext) => {
  const shouldRender = await shouldRenderItem(item, caseWorkflowContext);
  if (!shouldRender) {
    return [];
  }
  return await resolveContentItem(item, caseWorkflowContext);
};

export const buildBeforeContent = async (
  workflowStage,
  caseWorkflowContext,
) => {
  const beforeContentDefs = workflowStage.beforeContent || [];

  const resolvedItems = await Promise.all(
    beforeContentDefs.map((item) =>
      processBeforeContentItem(item, caseWorkflowContext),
    ),
  );

  return resolvedItems.flat();
};
