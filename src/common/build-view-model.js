import Boom from "@hapi/boom";
import { JSONPath } from "jsonpath-plus";
import { resolveJSONPath } from "./resolve-json.js";

export const createRootContext = (kase, workflow) => ({
  ...kase,
  definitions: { ...workflow.definitions },
  ...(workflow.externalActions && {
    externalActions: workflow.externalActions,
  }),
});

export const assertPathExists = (root, path) => {
  if (!pathExists(root, path)) {
    throw Boom.notFound(`Path does not exist, ${path} resolves to falsy value`);
  }
};

export const pathExists = (root, path) => {
  if (path) {
    return Boolean(resolveJSONPath({ root, path }));
  }
  return true;
};

export const buildLinks = (kase, workflow) => {
  const caseId = kase._id;

  const links = [
    {
      id: "tasks",
      href: `/cases/${caseId}`,
      text: "Tasks",
    },
    {
      id: "case-details",
      href: `/cases/${caseId}/case-details`,
      text: "Case Details",
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
  const knownLinkIds = links.map((link) => link.id);

  const tabsObject =
    JSONPath({
      json: workflow,
      path: "$.pages.cases.details.tabs",
    })?.[0] ?? {};

  const tabs = Object.entries(tabsObject)
    .map(([key, value]) => ({
      key,
      ...value,
    }))
    .filter((tab) => !knownLinkIds.includes(tab.key));

  const root = createRootContext(kase, workflow);
  tabs.forEach((tab) => {
    if (!pathExists(root, tab.renderIf)) {
      return;
    }

    links.push({
      id: tab.key,
      href: `/cases/${caseId}/${tab.key}`,
      text: idToText(tab.key),
    });
  });

  return links;
};

const idToText = (segment) => {
  return segment
    .split("-") // split into words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1)) // capitalise first letter
    .join(" "); // join back with spaces
};

const addCallToActionToBanner = (banner, externalActions) => {
  if (!banner || !externalActions || externalActions.length === 0) {
    return;
  }

  banner.callToAction = externalActions.map((action) => ({
    code: action.code,
    name: action.name,
  }));
};

export const buildBanner = (kase, workflow) => {
  const [bannerJson] = JSONPath({
    json: workflow,
    path: "$.pages.cases.details.banner",
  });

  const root = createRootContext(kase, workflow);
  const banner = resolveJSONPath({ root, path: bannerJson });

  addCallToActionToBanner(banner, root.externalActions);

  return banner;
};
