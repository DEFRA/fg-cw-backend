import { logger } from "../../common/logger.js";
import { resolveJSONPath } from "../../common/resolve-json.js";

const shouldRenderItem = async (item, caseWorkflowContext) => {
  if (!item.renderIf) {
    logger.info("[stageContent] No renderIf condition, defaulting to true");
    return true;
  }

  return resolveJSONPath({
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

const processStageContentItem = async (item, caseWorkflowContext) => {
  const shouldRender = await shouldRenderItem(item, caseWorkflowContext);
  if (!shouldRender) {
    return [];
  }
  return resolveContentItem(item, caseWorkflowContext);
};

const buildContent = async (items, caseWorkflowContext) => {
  if (!items) {
    return [];
  }

  const resolvedItems = await Promise.all(
    items.map((item) => processStageContentItem(item, caseWorkflowContext)),
  );

  return resolvedItems.flat();
};

export const buildBeforeContent = (workflowStage, caseWorkflowContext) =>
  buildContent(workflowStage.beforeContent, caseWorkflowContext);

export const buildAfterContent = (workflowStage, caseWorkflowContext) =>
  buildContent(workflowStage.afterContent, caseWorkflowContext);
