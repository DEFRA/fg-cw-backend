import { JSONPath } from "jsonpath-plus";
import { applyFormat } from "./format.js";

// eslint-disable-next-line complexity
export const resolveJSONPath = ({ root, path, row }) => {
  if (path === null) {
    return path;
  }
  if (typeof path === "string") {
    return resolveJSONString({ path, root, row });
  }
  if (Array.isArray(path)) {
    return resolveJSONArray({ path, root, row });
  }
  if (typeof path === "object") {
    return resolveJSONObject({ path, root, row });
  }
  return path;
};

const resolveJSONString = ({ path, root, row }) => {
  if (isLiteralRef(path)) {
    return path.slice(1);
  }
  if (isRef(path)) {
    return jp({ root, path, row });
  }
  return path;
};

const resolveJSONArray = ({ path, root, row }) => {
  return path.flatMap((item) => {
    const resolved = resolveJSONPath({ root, path: item, row });
    if (Array.isArray(resolved) && isRepeat(item)) {
      return resolved;
    }
    return [resolved];
  });
};

const resolveJSONObject = ({ path, root, row }) => {
  const specialCase = handleSpecialCases({ path, root, row });
  if (specialCase) {
    return specialCase;
  }

  const resolved = resolveGenericObject({ path, root, row });
  return applyFormatsRecursively(resolved);
};

const handleSpecialCases = ({ path, root, row }) => {
  if (isTable(path)) {
    return resolveTableSection({ path, root, row });
  }
  if (isAccordion(path)) {
    return resolveAccordionSection({ path, root, row });
  }
  if (isRepeat(path)) {
    return resolveRepeatComponent({ path, root, row });
  }
  return handleUrlTemplate({ path, root, row });
};

const handleUrlTemplate = ({ path, root, row }) => {
  if ("urlTemplate" in path) {
    return resolveUrlTemplate({ path, root, row });
  }
  return null;
};

const isTable = (path) => path.rowsRef && path.rows;
const isAccordion = (path) =>
  path.component === "accordion" && path.itemsRef && path.items;
const isRepeat = (path) =>
  path.component === "repeat" && path.itemsRef && path.items;

const resolveGenericObject = ({ path, root, row }) => {
  const resolved = {};
  Object.entries(path).forEach(([key, val]) => {
    const resolvedValue = resolveJSONPath({ root, path: val, row });
    if (resolvedValue !== undefined) {
      resolved[key] = resolvedValue;
    }
  });

  if ("component" in path && !resolved.component) {
    resolved.component = "text";
  }

  return resolved;
};

const applyFormatsRecursively = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(applyFormatsRecursively);
  }

  if (typeof obj === "object" && obj !== null) {
    return applyFormatsToObject(obj);
  }

  return obj;
};

const applyFormatsToObject = (obj) => {
  const result = { ...obj };

  if (result.format && result.text !== undefined) {
    result.text = applyFormat(result.text, result.format);
    delete result.format;
  }

  Object.keys(result).forEach((key) => {
    result[key] = applyFormatsRecursively(result[key]);
  });

  return result;
};

const resolveUrlTemplate = ({ path, root, row }) => {
  const template = resolveJSONPath({ root, path: path.urlTemplate, row });
  const params = resolveJSONPath({ root, path: path.params || {}, row });
  return populateUrlTemplate(template, params);
};

const resolveTableSection = ({ path, root, row }) => {
  const { rowsRef, rows, ...resolvable } = path;
  const dataRows = JSONPath({ json: root, path: rowsRef });

  const tableRows = dataRows.map((rowItem) => {
    return resolveJSONPath({ root, path: rows, row: rowItem });
  });

  const resolvedSection = resolveJSONPath({ root, path: resolvable, row });
  resolvedSection.rows = tableRows;

  return resolvedSection;
};

const resolveAccordionSection = ({ path, root, row }) => {
  const { itemsRef, items, ...resolvable } = path;
  const dataItems = evalPath({ root, path: itemsRef, row });

  const accordionItems = dataItems.map((itemData) => {
    return resolveJSONPath({ root, path: items, row: itemData });
  });

  const resolvedSection = resolveJSONPath({ root, path: resolvable, row });
  resolvedSection.items = accordionItems;

  return resolvedSection;
};

const resolveRepeatComponent = ({ path, root, row }) => {
  const { itemsRef, items } = path;
  const dataItems = evalPath({ root, path: itemsRef, row });

  const repeatedItems = dataItems.flatMap((itemData) => {
    const resolved = resolveJSONPath({ root, path: items, row: itemData });
    return Array.isArray(resolved) ? resolved : [resolved];
  });

  return repeatedItems;
};

const isRef = (path) => isRootRef(path) || isRowRef(path);
const isRootRef = (path) => typeof path === "string" && path.startsWith("$.");
const isRowRef = (path) => typeof path === "string" && path.startsWith("@.");
const isLiteralRef = (path) =>
  typeof path === "string" &&
  (path.startsWith("\\$.") || path.startsWith("\\@."));

// Return a single value for a JSONPath (first match or empty string).
export const jp = ({ root, path, row }) => {
  const out = evalPath({ root, path, row });
  return out.length ? out[0] : "";
};

// eslint-disable-next-line complexity
const evalPath = ({ root, path, row }) => {
  if (typeof path !== "string") {
    return [];
  }
  if (isLiteralRef(path)) {
    return [];
  }
  if (isRootRef(path)) {
    return JSONPath({ json: root, path });
  }
  if (isRowRef(path)) {
    return resolveRow({ path, row });
  }
  return JSONPath({ json: root, path });
};

const resolveRow = ({ path, row }) => {
  if (row === null) {
    return [];
  }
  const jsonPath = "$." + path.slice(2);
  return JSONPath({ json: row, path: jsonPath });
};

export const populateUrlTemplate = (template, params) =>
  template.replace(/\{([^}]{0,100})}/g, (_, key) =>
    encodeURIComponent(params[key] ?? ""),
  );
