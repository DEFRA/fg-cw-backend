import jsonata from "jsonata";
import { JSONPath } from "jsonpath-plus";
import { applyFormat } from "./format.js";

const NO_SPECIAL_CASE = Symbol("no-special-case");

// eslint-disable-next-line complexity
export const resolveJSONPath = async ({ root, path, row }) => {
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

// eslint-disable-next-line complexity
const resolveJSONString = async ({ path, root, row }) => {
  if (isLiteralRef(path)) {
    return path.slice(1);
  }
  // Check for JSONata expression
  if (isJSONataExpression(path)) {
    return await evaluateJSONata({ path, root });
  }
  // Check for multiple space-separated JSONPath references (before single ref check)
  if (hasMultipleRefs(path)) {
    return resolveMultipleRefs({ path, root, row });
  }
  if (isRef(path)) {
    return jp({ root, path, row });
  }
  return path;
};

// eslint-disable-next-line complexity
const resolveJSONArray = async ({ path, root, row }) => {
  const results = [];

  for (const item of path) {
    const resolved = await resolveJSONPath({ root, path: item, row });
    if (
      Array.isArray(resolved) &&
      (isRepeat(item) || isComponentContainer(item))
    ) {
      results.push(...resolved);
    } else {
      results.push(resolved);
    }
  }

  return results;
};

const resolveJSONObject = async ({ path, root, row }) => {
  const specialCase = await handleSpecialCases({ path, root, row });
  if (specialCase !== NO_SPECIAL_CASE) {
    return specialCase;
  }

  const resolved = await resolveGenericObject({ path, root, row });
  return applyFormatsRecursively(resolved);
};

// eslint-disable-next-line complexity
const handleSpecialCases = async ({ path, root, row }) => {
  if (isConditional(path)) {
    return resolveConditionalComponent({ path, root, row });
  }
  if (isTable(path)) {
    return resolveTableSection({ path, root, row });
  }
  if (isAccordion(path)) {
    return resolveAccordionSection({ path, root, row });
  }
  if (isRepeat(path)) {
    return resolveRepeatComponent({ path, root, row });
  }
  if (isComponentContainer(path)) {
    return resolveComponentContainer({ path, root, row });
  }
  const urlTemplateResult = handleUrlTemplate({ path, root, row });
  if (urlTemplateResult !== undefined) {
    return urlTemplateResult;
  }
  return NO_SPECIAL_CASE;
};

const handleUrlTemplate = ({ path, root, row }) => {
  if ("urlTemplate" in path) {
    return resolveUrlTemplate({ path, root, row });
  }
  return undefined;
};

const isTable = (path) => path.rowsRef && path.rows;
const isAccordion = (path) =>
  path.component === "accordion" && path.itemsRef && path.items;
const isRepeat = (path) =>
  path.component === "repeat" && path.itemsRef && path.items;
const isComponentContainer = (path) =>
  path.component === "component-container" && path.contentRef;
const hasConditionalBranch = (path) =>
  Object.prototype.hasOwnProperty.call(path, "whenTrue") ||
  Object.prototype.hasOwnProperty.call(path, "whenFalse");

const isConditional = (path) =>
  path.component === "conditional" &&
  path.condition &&
  hasConditionalBranch(path);

// eslint-disable-next-line complexity
const resolveGenericObject = async ({ path, root, row }) => {
  const resolved = {};
  for (const [key, val] of Object.entries(path)) {
    const resolvedValue = await resolveJSONPath({ root, path: val, row });
    if (resolvedValue !== undefined) {
      resolved[key] = resolvedValue;
    }
  }

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

const resolveUrlTemplate = async ({ path, root, row }) => {
  const template = await resolveJSONPath({ root, path: path.urlTemplate, row });
  const params = await resolveJSONPath({ root, path: path.params || {}, row });
  return populateUrlTemplate(template, params);
};

const resolveTableSection = async ({ path, root, row }) => {
  const { rowsRef, rows, ...resolvable } = path;
  const dataRows = await resolveDataRef({ root, path: rowsRef, row });

  const tableRows = [];
  for await (const rowItem of dataRows) {
    tableRows.push(await resolveJSONPath({ root, path: rows, row: rowItem }));
  }

  const resolvedSection = await resolveJSONPath({
    root,
    path: resolvable,
    row,
  });
  resolvedSection.rows = tableRows;

  return resolvedSection;
};

const resolveAccordionSection = async ({ path, root, row }) => {
  const { itemsRef, items, ...resolvable } = path;
  const dataItems = await resolveDataRef({ root, path: itemsRef, row });

  const accordionItems = [];
  for await (const itemData of dataItems) {
    accordionItems.push(
      await resolveJSONPath({ root, path: items, row: itemData }),
    );
  }

  const resolvedSection = await resolveJSONPath({
    root,
    path: resolvable,
    row,
  });
  resolvedSection.items = accordionItems;

  return resolvedSection;
};

const resolveRepeatComponent = async ({ path, root, row }) => {
  const { itemsRef, items } = path;
  const dataItems = await resolveDataRef({ root, path: itemsRef, row });

  const repeatedItems = [];
  for await (const itemData of dataItems) {
    const resolved = await resolveJSONPath({
      root,
      path: items,
      row: itemData,
    });
    if (Array.isArray(resolved)) {
      repeatedItems.push(...resolved);
    } else {
      repeatedItems.push(resolved);
    }
  }

  return repeatedItems;
};

const resolveComponentContainer = ({ path, root }) => {
  const { contentRef } = path;
  const content = JSONPath({ json: root, path: contentRef });
  return content[0] || [];
};

const evaluateConditionalWithRow = async ({ condition, root, row }) => {
  const expression = condition.replace("jsonata:", "").replace(/@\./g, "$row.");
  const compiledExpression = jsonata(expression);
  compiledExpression.assign("row", row);
  return compiledExpression.evaluate(root);
};

const evaluateConditionResult = (conditionResult) => {
  if (Array.isArray(conditionResult)) {
    return conditionResult.length > 0 && Boolean(conditionResult[0]);
  }
  return Boolean(conditionResult);
};

const hasRowReference = ({ row, condition }) => {
  return row && isJSONataExpression(condition) && condition.includes("@.");
};

const resolveConditionalComponent = async ({ path, root, row }) => {
  const { condition, whenTrue, whenFalse } = path;

  const conditionResult = hasRowReference({ row, condition })
    ? await evaluateConditionalWithRow({ condition, root, row })
    : await resolveDataRef({ root, path: condition, row });

  const isTrue = evaluateConditionResult(conditionResult);
  const selectedComponent = isTrue ? whenTrue : whenFalse;
  if (selectedComponent === undefined) {
    return undefined;
  }
  return resolveJSONPath({ root, path: selectedComponent, row });
};

const hasMultipleRefs = (path) => {
  // Check if string contains multiple space-separated JSONPath references
  const parts = path.split(" ");
  return parts.length > 1 && parts.some((part) => isRef(part));
};

const resolveMultipleRefs = ({ path, root, row }) => {
  // Split by spaces, resolve each part, and join back with spaces
  const parts = path.split(" ");
  const resolved = parts.map((part) => {
    if (isRef(part)) {
      return jp({ root, path: part, row });
    }
    return part;
  });
  // Filter out empty strings and join with spaces
  return resolved.filter((val) => val !== "").join(" ");
};

const isRef = (path) => isRootRef(path) || isRowRef(path);
const isRootRef = (path) => typeof path === "string" && path.startsWith("$.");
const isRowRef = (path) => typeof path === "string" && path.startsWith("@.");
const isLiteralRef = (path) =>
  typeof path === "string" &&
  (path.startsWith("\\$.") || path.startsWith("\\@."));
const isJSONataExpression = (path) =>
  typeof path === "string" && path.startsWith("jsonata:");

const toArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === undefined || value === null) {
    return [];
  }
  return [value];
};

const resolveDataRef = async ({ root, path, row }) => {
  if (typeof path !== "string") {
    return [];
  }
  if (isJSONataExpression(path)) {
    return toArray(await evaluateJSONata({ path, root }));
  }
  return evalPath({ root, path, row });
};

const evaluateJSONata = async ({ path, root }) => {
  const expression = path.replace("jsonata:", "");
  const compiledExpression = jsonata(expression);
  return await compiledExpression.evaluate(root);
};

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
