import { JSONPath } from "jsonpath-plus";
import { resolveBannerPaths } from "./resolve-paths.js";

const isRef = (path) => isRootRef(path) || isRowRef(path);
const isRootRef = (path) => typeof path === "string" && path.startsWith("$.");
const isRowRef = (path) => typeof path === "string" && path.startsWith("@.");
const isLiteralRef = (path) =>
  typeof path === "string" &&
  (path.startsWith("\\$.") || path.startsWith("\\@."));

// Return a single value for a JSONPath (first match or empty string).
export const jp = (root, path, row) => {
  const out = evalPath(root, path, row);
  return out.length ? out[0] : "";
};

const evalPath = (root, path, row) => {
  if (typeof path !== "string") return [];
  if (isLiteralRef(path)) return [];
  if (isRootRef(path)) return JSONPath({ json: root, path });
  if (isRowRef(path)) return getRowValue(path, row);
  return JSONPath({ json: root, path });
};

const getRowValue = (path, row) => {
  if (row == null) return [];
  const jsonPath = "$." + path.slice(2);
  return JSONPath({ json: row, path: jsonPath });
};

export const resolveRecursively = (root, value, row) => {
  // Handle null/undefined
  if (value == null) return value;

  // Handle strings - resolve refs and literals
  if (typeof value === "string") {
    if (isLiteralRef(value)) return value.slice(1);
    if (isRef(value)) return jp(root, value, row);
    return value;
  }

  // Handle arrays - recursively resolve each element
  if (Array.isArray(value)) {
    return value.map((item) => resolveRecursively(root, item, row));
  }

  // Handle objects
  if (typeof value === "object") {
    // Special case: urlTemplate objects
    if ("urlTemplate" in value) {
      const template = resolveRecursively(root, value.urlTemplate, row);
      const params = resolveRecursively(root, value.params || {}, row);
      return populateUrlTemplate(template, params);
    }

    // General object processing - recursively resolve all properties
    const resolved = {};
    for (const [key, val] of Object.entries(value)) {
      const resolvedValue = resolveRecursively(root, val, row);
      if (resolvedValue !== undefined) {
        resolved[key] = resolvedValue;
      }
    }
    return resolved;
  }

  // Handle primitives (numbers, booleans, etc.)
  return value;
};

export const populateUrlTemplate = (template, params) =>
  template.replace(/\{([^\}]+)\}/g, (_, key) =>
    encodeURIComponent(params[key] ?? ""),
  );

export const shouldRender = (root, item) => {
  if (item?.renderIf) {
    return Boolean(resolveRecursively(root, item.renderIf));
  }
  return true;
};

export const buildTabLinks = (kase, workflow) => {
  const caseId = kase._id;

  const links = [
    {
      id: "tasks",
      href: `/cases/${caseId}`,
      text: "Tasks",
    },
    {
      id: "notes",
      href: `/cases/${caseId}/notes`,
      text: "Notes",
    },
    {
      id: "timeline",
      href: `/cases/${caseId}/timeline`,
      text: "Timeline",
    },
  ];

  const root = {
    ...kase,
    definitions: { ...workflow.definitions },
  };

  const tabs = JSONPath({
    json: workflow,
    path: "$.pages.cases.details.tabs[*]",
  });

  tabs.forEach((tab) => {
    if (!shouldRender(root, tab)) {
      return;
    }

    const link = tab.link;
    if (!link) {
      return; // Skip if no link
    }

    const processedLink = {
      ...link,
      href: resolveRecursively(root, link.href),
    };

    if (link.index) {
      links.splice(link.index, 0, processedLink);
    } else {
      links.push(processedLink);
    }
  });

  return links;
};

export const buildBanner = (kase, workflow) => {
  const [bannerJson] = JSONPath({
    json: workflow,
    path: "$.pages.cases.details.banner",
  });

  return resolveBannerPaths(bannerJson, kase);
};
