import Boom from "@hapi/boom";
import { JSONPath } from "jsonpath-plus";
import {
  buildBanner,
  buildTabLinks,
  buildUrl,
  resolveParam,
  resolveTextComponent,
  shouldRender,
} from "../../common/json-utils.js";
import { findById } from "../repositories/case.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";

export const buildCaseDetailsTabUseCase = async (caseId, tabId) => {
  const kase = await findById(caseId);
  const workflow = await findByCode(kase.workflowCode);
  const root = {
    ...kase,
    definitions: { ...workflow.definitions },
  };

  const tabDefinition = getTabDefinition({ root, workflow, tabId });
  if (!shouldRender(root, tabDefinition)) {
    throw Boom.notFound(
      `Should not render Case with id "${caseId}", ${tabDefinition?.renderIf} is ${resolveParam(root, tabDefinition?.renderIf)}`,
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
  const rowsRef = sectionDef.rowsRef;
  if (!rowsRef) {
    throw new Error("rowsRef is required for tables");
  }

  const dataRows = JSONPath({ json: root, path: rowsRef });

  const tableRows = dataRows.map((rowItem) => {
    return sectionDef.fields.map((fieldDef) => {
      return resolveField(root, fieldDef, rowItem);
    });
  });

  const resolvedSection = {
    title: resolveTextComponent(root, sectionDef.title),
    component: sectionDef.component || "table",
    rows: tableRows,
  };

  for (const [k, v] of Object.entries(sectionDef)) {
    if (
      k === "rowsRef" ||
      k === "fields" ||
      k === "component" ||
      k === "title" ||
      k === "type"
    )
      continue;
    const val = resolveParam(root, v);
    if (val !== undefined) resolvedSection[k] = val;
  }

  return resolvedSection;
};

const buildList = (root, sectionDef) => {
  const rows = sectionDef.fields.map((fieldDef) => {
    return resolveField(root, fieldDef);
  });

  return {
    title: resolveTextComponent(root, sectionDef.title),
    component: sectionDef.component || "list",
    rows,
  };
};

const buildGenericSection = (root, sectionDef) => {
  const resolvedSection = {};

  // Process all properties of the section definition
  for (const [key, value] of Object.entries(sectionDef)) {
    if (key === "elements") {
      resolvedSection.elements = value.map((element) => {
        const resolvedElement = {};
        for (const [ek, ev] of Object.entries(element)) {
          if (ek === "text" || ek === "label") {
            resolvedElement[ek] = resolveTextComponent(root, ev);
          } else if (ev && typeof ev === "object" && "urlTemplate" in ev) {
            resolvedElement[ek] = buildUrl(root, {
              template: ev.urlTemplate,
              params: ev.params,
            });
          } else {
            resolvedElement[ek] = resolveParam(root, ev);
          }
        }
        return resolvedElement;
      });
    } else if (key === "text" || key === "label") {
      // Handle text/label properties that can be strings or objects
      resolvedSection[key] = resolveTextComponent(root, value);
    } else {
      // Resolve other properties normally
      resolvedSection[key] = resolveParam(root, value);
    }
  }

  // Default component to "text" if not specified
  if (!resolvedSection.component) {
    resolvedSection.component = "text";
  }

  return resolvedSection;
};

const resolveField = (root, fieldDef, rowItem = null) => {
  const component = fieldDef.component || "text";
  const resolvedField = {
    component,
    label: resolveTextComponent(root, fieldDef.label, rowItem),
  };

  for (const [k, v] of Object.entries(fieldDef)) {
    // Skip properties that are already handled or structural
    if (k === "component" || k === "label") continue;

    if (k === "text") {
      resolvedField.text = resolveTextComponent(root, v, rowItem);
    } else if (k === "href") {
      // allow string, urlTemplate
      const maybe = resolveParam(root, v, rowItem);
      if (typeof maybe === "string") {
        resolvedField.href = maybe;
      } else if (v && typeof v === "object" && "urlTemplate" in v) {
        resolvedField.href = buildUrl(
          root,
          { template: v.urlTemplate, params: v.params },
          rowItem,
        );
      }
    } else if (k === "elements") {
      resolvedField.elements = v.map((element) => {
        const resolvedElement = {};
        for (const [ek, ev] of Object.entries(element)) {
          if (ek === "text" || ek === "label") {
            resolvedElement[ek] = resolveTextComponent(root, ev, rowItem);
          } else {
            resolvedElement[ek] = resolveParam(root, ev, rowItem);
          }
        }
        return resolvedElement;
      });
    } else {
      const val = resolveParam(root, v, rowItem);
      if (val !== undefined) resolvedField[k] = val;
    }
  }

  return resolvedField;
};
