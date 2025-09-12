import { JSONPath } from "jsonpath-plus";
import { resolveBannerPaths } from "./resolve-paths.js";

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
export const jp = (root, path, row) => {
  const out = evalPath(root, path, row);
  return out.length ? out[0] : "";
};

export const expandUriTemplate = (template, params) =>
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

  return expandUriTemplate(template, params);
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

  if ("ref" in entry) {
    return jp(root, entry.ref, row);
  }
  if ("urlTemplate" in entry)
    return buildUrl(
      root,
      { template: entry.urlTemplate, params: entry.params },
      row,
    );
  if ("uriTemplate" in entry) return buildUrl(root, entry, row);
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

export const buildTabLinks = (kase, workflow) => {
  const caseId = kase._id;
  const root = {
    ...kase,
    caseId,
    definitions: { ...workflow.definitions },
  };

  const [tabLinks] = JSONPath({
    json: workflow,
    path: "$.pages.cases.details.links",
  });

  return tabLinks?.map((link) => ({
    ...link,
    href: link.href?.urlTemplate
      ? buildUrl(root, {
          template: link.href.urlTemplate,
          params: link.href.params,
        })
      : link.href?.uriTemplate
        ? buildUrl(root, link.href)
        : resolveParam(root, link.href),
  }));
};

export const buildBanner = (kase, workflow) => {
  const [bannerJson] = JSONPath({
    json: workflow,
    path: "$.pages.cases.details.banner",
  });

  return resolveBannerPaths(bannerJson, kase);
};
