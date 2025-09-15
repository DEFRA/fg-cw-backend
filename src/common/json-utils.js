import { JSONPath } from "jsonpath-plus";

export const resolveJSONPath = ({ root, path, row }) => {
  if (path == null) {
    return path;
  }

  if (typeof path === "string") {
    if (isLiteralRef(path)) return path.slice(1);
    if (isRef(path)) return jp({ root, path, row });
    return path;
  }

  if (Array.isArray(path)) {
    return path.map((item) => resolveJSONPath({ root, path: item, row }));
  }

  if (typeof path === "object") {
    // Special case: urlTemplate objects
    if ("urlTemplate" in path) {
      const template = resolveJSONPath({ root, path: path.urlTemplate, row });
      const params = resolveJSONPath({ root, path: path.params || {}, row });
      return populateUrlTemplate(template, params);
    }

    // recursively resolve all properties
    const resolved = {};
    for (const [key, val] of Object.entries(path)) {
      const resolvedValue = resolveJSONPath({ root, path: val, row });
      if (resolvedValue !== undefined) {
        resolved[key] = resolvedValue;
      }
    }
    return resolved;
  }

  return path;
};

export const createRootContext = (kase, workflow) => ({
  ...kase,
  definitions: { ...workflow.definitions },
});
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

const evalPath = ({ root, path, row }) => {
  if (typeof path !== "string") return [];
  if (isLiteralRef(path)) return [];
  if (isRootRef(path)) return JSONPath({ json: root, path });
  if (isRowRef(path)) return getRowValue({ path, row });
  return JSONPath({ json: root, path });
};

const getRowValue = ({ path, row }) => {
  if (row == null) return [];
  const jsonPath = "$." + path.slice(2);
  return JSONPath({ json: row, path: jsonPath });
};

export const populateUrlTemplate = (template, params) =>
  template.replace(/\{([^\}]+)\}/g, (_, key) =>
    encodeURIComponent(params[key] ?? ""),
  );

export const shouldRender = (root, item) => {
  if (item?.renderIf) {
    return Boolean(resolveJSONPath({ root, path: item.renderIf }));
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

  const root = createRootContext(kase, workflow);

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
      href: resolveJSONPath({ root, path: link.href }),
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

  const root = createRootContext(kase, workflow);
  return resolveJSONPath({ root, path: bannerJson });
};
