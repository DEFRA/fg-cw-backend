import Boom from "@hapi/boom";
import { JSONPath } from "jsonpath-plus";
import {
  buildBanner,
  buildTabLinks,
  createRootContext,
  resolveJSONPath,
  shouldRender,
} from "../../common/json-utils.js";
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
  const content = buildTab(root, tabDefinition);

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

export const buildTab = (root, tabDefinition) => {
  return tabDefinition.sections.map((section) => {
    switch (section.component) {
      case "table":
        return buildTable(root, section);
      case "list":
        return buildList(root, section);
      default:
        return buildGenericSection(root, section);
    }
  });
};

const buildTable = (root, sectionDef) => {
  const { rowsRef, fields, ...resolvable } = sectionDef;
  if (!rowsRef) {
    throw new Error("rowsRef is required for tables");
  }

  const dataRows = JSONPath({ json: root, path: rowsRef });

  const tableRows = dataRows.map((rowItem) => {
    return fields.map((fieldDef) => {
      return buildField(root, fieldDef, rowItem);
    });
  });

  const resolvedSection = resolveJSONPath({ root, path: resolvable });
  resolvedSection.rows = tableRows;

  return resolvedSection;
};

const buildList = (root, sectionDef) => {
  const { fields, ...resolvable } = sectionDef;

  const rows = fields.map((fieldDef) => {
    return buildField(root, fieldDef);
  });

  const resolvedSection = resolveJSONPath({ root, path: resolvable });
  resolvedSection.rows = rows;

  if (!resolvedSection.component) {
    resolvedSection.component = "list";
  }

  return resolvedSection;
};

const buildGenericSection = (root, sectionDef) => {
  const resolvedSection = resolveJSONPath({ root, path: sectionDef });

  if (!resolvedSection.component) {
    resolvedSection.component = "text";
  }

  return resolvedSection;
};

const buildField = (root, fieldDef, rowItem = null) => {
  const { component, label, ...resolvable } = fieldDef;

  const resolvedField = resolveJSONPath({
    root,
    path: resolvable,
    row: rowItem,
  });
  resolvedField.component = component || "text";
  resolvedField.label = resolveJSONPath({ root, path: label, row: rowItem });

  return resolvedField;
};
