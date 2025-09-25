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

// eslint-disable-next-line complexity
const resolveJSONString = ({ path, root, row }) => {
  if (isLiteralRef(path) && !isRef(path)) {
    return path.replace(/\\(\$\.|@\.)/g, "$1");
  }
  if (isRef(path)) {
    if (isRootRef(path) || isRowRef(path)) {
      return jp({ root, path, row });
    }
    return path.replace(
      /(\\?)(\$\.[a-zA-Z_][a-zA-Z0-9_.[\]]*|@\.[a-zA-Z_][a-zA-Z0-9_.[\]]*)/g,
      (match, escape, jsonPath) => {
        if (escape) {
          return jsonPath;
        }
        const resolved = jp({ root, path: jsonPath, row });
        return resolved || match;
      },
    );
  }
  return path;
};

const resolveJSONArray = ({ path, root, row }) => {
  const resolved = path.map((item) =>
    resolveJSONPath({ root, path: item, row }),
  );

  // Recursively flatten nested arrays from repeatable components
  const flattenDeep = (arr) => {
    return arr.reduce((acc, val) => {
      if (Array.isArray(val)) {
        acc.push(...flattenDeep(val));
      } else {
        acc.push(val);
      }
      return acc;
    }, []);
  };

  return flattenDeep(resolved);
};

const resolveJSONObject = ({ path, root, row }) => {
  const specialCase = handleSpecialCases({ path, root, row });
  if (specialCase) {
    return specialCase;
  }

  const resolved = resolveGenericObject({ path, root, row });
  return applyFormatsRecursively(resolved);
};

// eslint-disable-next-line complexity
const handleSpecialCases = ({ path, root, row }) => {
  if (path.rowsRef && path.rows) {
    return resolveTableSection({ path, root, row });
  }
  if (path.rowsRef && path.items) {
    return resolveRepeatableSection({ path, root, row });
  }
  if ("urlTemplate" in path) {
    return resolveUrlTemplate({ path, root, row });
  }
  return null;
};

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

const resolveRepeatableSection = ({ path, root, row }) => {
  const { rowsRef, items } = path;

  let dataRows;
  if (rowsRef.startsWith("@.")) {
    // Handle row references - use current row context
    if (!row) {
      return []; // No row context = return empty array
    }
    const jsonPath = "$." + rowsRef.slice(2); // Convert @.actions[*] to $.actions[*]
    dataRows = JSONPath({ json: row, path: jsonPath });
  } else {
    // Handle root references
    dataRows = JSONPath({ json: root, path: rowsRef });
  }

  // Return flattened array of resolved items
  return dataRows.flatMap((rowItem) => {
    return items.map((item) =>
      resolveJSONPath({ root, path: item, row: rowItem }),
    );
  });
};

const isRef = (path) => {
  if (typeof path !== "string") return false;
  return /(?<!\\)(\$\.|@\.)/.test(path);
};

const isRootRef = (path) => typeof path === "string" && path.startsWith("$.");
const isRowRef = (path) => typeof path === "string" && path.startsWith("@.");

const isLiteralRef = (path) => {
  if (typeof path !== "string") return false;
  return /\\(\$\.|@\.)/.test(path);
};

// Return a single value for a JSONPath (first match or empty string).
export const jp = ({ root, path, row }) => {
  const out = evalPath({ root, path, row }) || [];
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
