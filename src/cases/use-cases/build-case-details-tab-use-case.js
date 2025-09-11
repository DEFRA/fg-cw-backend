import Boom from "@hapi/boom";
import { JSONPath } from "jsonpath-plus";
import { findById } from "../repositories/case.repository.js";
import { findByCode } from "../repositories/workflow.repository.js";

export const buildCaseDetailsTabUseCase = async (caseId, tabId) => {
  const kase = await findById(caseId);
  const workflow = await findByCode(kase.workflowCode);

  // TODO: check permissions!!!

  const [tabDefinition] = JSONPath({
    json: workflow,
    path: `$.pages.cases.details.tabs.${tabId}`,
  });

  const root = {
    ...kase,
    caseId,
    definitions: { ...workflow.definitions },
  };

  if (!shouldRender(root, tabDefinition)) {
    throw Boom.notFound(
      `Should not render Case with id "${caseId}", ${tabDefinition?.renderIf} is ${resolveParam(root, tabDefinition?.renderIf)}`,
    );
  }

  const data = buildTab(root, tabDefinition);

  return {
    caseId,
    caseRef: kase.caseRef,
    tabId,
    banner: kase.banner,
    links: resolveTabLinks(root, workflow?.pages?.cases?.details?.tabLinks),
    content: data,
  };
};

const shouldRender = (root, tabDefinition) => {
  if (tabDefinition?.renderIf) {
    return Boolean(resolveParam(root, tabDefinition.renderIf));
  }

  return true;
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

const isRef = (s) =>
  typeof s === "string" && (s.startsWith("$.") || s.startsWith("@."));

const isEscapedRef = (s) =>
  typeof s === "string" && (s.startsWith("\\$.") || s.startsWith("\\@."));

const evalPath = (root, path, row) => {
  if (typeof path !== "string") return [];
  if (path.startsWith("\\$.") || path.startsWith("\\@.")) return []; // escaped: caller handles
  if (path.startsWith("$.")) return JSONPath({ json: root, path });
  if (path.startsWith("@.")) {
    const jsonPath = "$." + path.slice(2);
    const targetObject = row == null ? root : row;
    return JSONPath({ json: targetObject, path: jsonPath });
  }
  return JSONPath({ json: root, path });
};

/** Return a single value for a JSONPath (first match or empty string). */
const jp = (root, path, row) => {
  const out = evalPath(root, path, row);
  return out.length ? out[0] : "";
};

/** -------- URL builder (RFC6570 level-1-ish) -------- */
const expandUriTemplate = (template, params) =>
  template.replace(/\{([^\}]+)\}/g, (_, key) =>
    encodeURIComponent(params[key] ?? ""),
  );

const buildUrl = (root, spec, row) => {
  // spec = { template, params }
  const template =
    typeof spec.template === "string"
      ? isEscapedRef(spec.template)
        ? spec.template.slice(1)
        : isRef(spec.template)
          ? jp(root, spec.template, row)
          : spec.template
      : "";

  const params = Object.fromEntries(
    Object.entries(spec.params || {}).map(([k, v]) => [
      k,
      resolveParam(root, v, row),
    ]),
  );

  return expandUriTemplate(template, params);
};

const resolveParam = (root, entry, row) => {
  if (entry == null) return undefined;

  if (typeof entry === "string") {
    if (isEscapedRef(entry)) return entry.slice(1); // "\\$.x" -> "$.x"
    if (isRef(entry)) return jp(root, entry, row);
    return entry; // plain literal
  }

  if (typeof entry !== "object") {
    return entry;
  }

  if ("ref" in entry) {
    return jp(root, entry.ref, row);
  }
  if ("buildUrl" in entry) return buildUrl(root, entry.buildUrl, row);
  return entry;
};

const resolveTextComponent = (root, textEntry, row) => {
  if (textEntry == null) return undefined;

  if (typeof textEntry === "string") {
    return resolveParam(root, textEntry, row);
  }

  if (typeof textEntry === "object") {
    if ("text" in textEntry) {
      const resolvedTextObj = {};

      // Process ALL properties in the text object
      for (const [key, value] of Object.entries(textEntry)) {
        const resolvedValue = resolveParam(root, value, row);
        if (resolvedValue !== undefined) {
          resolvedTextObj[key] = resolvedValue;
        }
      }

      return resolvedTextObj;
    } else {
      // Handle objects like {buildUrl: ...} by resolving via resolveParam
      return resolveParam(root, textEntry, row);
    }
  }

  return textEntry;
};

const buildTable = (root, sectionDef) => {
  const rowsRef = sectionDef.rowsRef;
  if (!rowsRef && sectionDef.type !== "array") {
    throw new Error("rowsRef is required for array sections");
  }

  const rows = rowsRef ? JSONPath({ json: root, path: rowsRef }) : [];

  const cellsByCol = sectionDef.fields.map((f) =>
    resolveFieldCells(root, f, rows),
  );

  const tableRows = rows.map((_, i) => {
    const rowObj = {};
    sectionDef.fields.forEach((f, colIdx) => {
      const cell = cellsByCol[colIdx][i];
      if (cell) rowObj[f.label || `col${colIdx}`] = cell;
    });
    return rowObj;
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
  const fields = sectionDef.fields.map((fieldDef) => {
    const component = fieldDef.component || "text";
    const resolvedField = {
      component,
      label: resolveTextComponent(root, fieldDef.label),
    };

    for (const [k, v] of Object.entries(fieldDef)) {
      // Skip properties that are already handled or structural
      if (k === "component" || k === "label") continue;

      if (k === "href") {
        // allow string, buildUrl, or legacy object with uriTemplate/params/query
        const maybe = resolveParam(root, v);
        if (typeof maybe === "string") {
          resolvedField.href = maybe;
        } else if (v && typeof v === "object" && "buildUrl" in v) {
          resolvedField.href = buildUrl(root, v.buildUrl);
        } else if (v && typeof v === "object" && "uriTemplate" in v) {
          resolvedField.href = buildUrl(root, v);
        }
      } else if (k === "elements") {
        resolvedField.elements = v.map((element) => {
          const resolvedElement = {};
          for (const [ek, ev] of Object.entries(element)) {
            if (ek === "text" || ek === "label") {
              resolvedElement[ek] = resolveTextComponent(root, ev);
            } else {
              resolvedElement[ek] = resolveParam(root, ev);
            }
          }
          return resolvedElement;
        });
      } else {
        const val = resolveParam(root, v);
        if (val !== undefined) resolvedField[k] = val;
      }
    }

    return resolvedField;
  });

  return {
    title: resolveTextComponent(root, sectionDef.title),
    component: sectionDef.component || "list",
    fields,
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
          } else if (ev && typeof ev === "object" && "buildUrl" in ev) {
            resolvedElement[ek] = buildUrl(root, ev.buildUrl);
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

const resolveFieldCells = (root, fieldDef, rows) => {
  // For each row item (from rowsRef), resolve the field into a single cell model
  const component = fieldDef.component || "text";

  return rows.map((rowItem) => {
    const resolvedCell = {
      component,
      label: resolveTextComponent(root, fieldDef.label, rowItem),
    };

    for (const [k, v] of Object.entries(fieldDef)) {
      // Skip properties that are already handled or structural
      if (k === "component" || k === "label") continue;

      if (k === "text") {
        resolvedCell.text = resolveTextComponent(root, v, rowItem);
      } else if (k === "href") {
        // allow string, buildUrl, or object with uriTemplate/params/query
        const maybe = resolveParam(root, v, rowItem);
        if (typeof maybe === "string") {
          resolvedCell.href = maybe;
        } else if (v && typeof v === "object" && "buildUrl" in v) {
          resolvedCell.href = buildUrl(root, v.buildUrl, rowItem);
        } else if (v && typeof v === "object" && "uriTemplate" in v) {
          resolvedCell.href = buildUrl(root, v, rowItem);
        }
      } else if (k === "elements") {
        resolvedCell.elements = v.map((element) => {
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
        if (val !== undefined) resolvedCell[k] = val;
      }
    }

    return resolvedCell;
  });
};

const resolveTabLinks = (root, tabLinkDefinitions) => {
  if (!tabLinkDefinitions) return [];

  return tabLinkDefinitions
    .filter((linkDef) => shouldRender(root, linkDef))
    .map((linkDef) => ({
      id: linkDef.id,
      href: resolveParam(root, linkDef.href),
      text: resolveParam(root, linkDef.text),
    }));
};
