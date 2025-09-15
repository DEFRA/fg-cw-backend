import { JSONPath } from "jsonpath-plus";
import { resolveBannerPaths } from "./resolve-paths.js";

const isRef = (s) =>
  typeof s === "string" && (s.startsWith("$.") || s.startsWith("@."));

const isEscapedRef = (s) =>
  typeof s === "string" && (s.startsWith("\\$.") || s.startsWith("\\@."));

/** Return a single value for a JSONPath (first match or empty string). */
export const jp = (root, path, row) => {
  const out = evalPath(root, path, row);
  return out.length ? out[0] : "";
};

const evalPath = (root, path, row) => {
  if (typeof path !== "string") return [];
  if (isLiteral(path)) return []; // escaped literal: caller handles
  if (path.startsWith("$.")) return JSONPath({ json: root, path });
  if (path.startsWith("@.")) return getRowValue(path, row);
  return JSONPath({ json: root, path });
};

const isLiteral = (path) => path.startsWith("\\$.") || path.startsWith("\\@.");

const getRowValue = (path, row) => {
  if (row == null) return [];
  const jsonPath = "$." + path.slice(2);
  return JSONPath({ json: row, path: jsonPath });
};

export const expandUrlTemplate = (template, params) =>
  template.replace(/\{([^\}]+)\}/g, (_, key) =>
    encodeURIComponent(params[key] ?? ""),
  );

export const buildUrl = (root, spec, row) => {
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

  return expandUrlTemplate(template, params);
};

export const resolveParam = (root, entry, row) => {
  if (entry == null) return undefined;

  if (typeof entry === "string") {
    if (isEscapedRef(entry)) return entry.slice(1); // "\\$.x" -> "$.x"
    if (isRef(entry)) return jp(root, entry, row);
    return entry; // plain literal
  }

  if (typeof entry !== "object") {
    return entry;
  }

  if ("urlTemplate" in entry)
    return buildUrl(
      root,
      { template: entry.urlTemplate, params: entry.params },
      row,
    );

  return entry;
};

export const resolveTextComponent = (root, textEntry, row) => {
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
      return resolveParam(root, textEntry, row);
    }
  }

  return textEntry;
};

export const shouldRender = (root, item) => {
  if (item?.renderIf) {
    return Boolean(resolveParam(root, item.renderIf));
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
      href: buildHref(root, link),
    };

    if (link.index) {
      links.splice(link.index, 0, processedLink);
    } else {
      links.push(processedLink);
    }
  });

  return links;
};

const buildHref = (root, link) => {
  return link.href?.urlTemplate
    ? buildUrl(root, {
        template: link.href.urlTemplate,
        params: link.href.params,
      })
    : resolveParam(root, link.href);
};

export const buildBanner = (kase, workflow) => {
  const [bannerJson] = JSONPath({
    json: workflow,
    path: "$.pages.cases.details.banner",
  });

  return resolveBannerPaths(bannerJson, kase);
};
