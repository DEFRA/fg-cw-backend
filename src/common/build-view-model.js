import Boom from "@hapi/boom";
import { JSONPath } from "jsonpath-plus";
import { resolveJSONPath } from "./resolve-json.js";

export const createCaseWorkflowContext = (kase, workflow, request = {}) => ({
  ...kase,
  workflow,
  definitions: { ...workflow.definitions },
  ...(workflow.externalActions && {
    externalActions: workflow.externalActions,
  }),
  request: { ...request },
});

export const assertPathExists = async (root, path) => {
  if (!(await pathExists(root, path))) {
    throw Boom.notFound(`Path does not exist, ${path} resolves to falsy value`);
  }
};

export const pathExists = async (root, path) => {
  if (path) {
    const resolved = await resolveJSONPath({ root, path });
    return Boolean(resolved);
  }
  return true;
};

// eslint-disable-next-line complexity
export const buildLinks = async (root) => {
  const caseId = root._id;

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
      json: root.workflow,
      path: "$.pages.cases.details.tabs",
    })?.[0] ?? {};

  const tabs = Object.entries(tabsObject)
    .map(([key, value]) => ({
      key,
      ...value,
    }))
    .filter((tab) => !knownLinkIds.includes(tab.key));

  for (const tab of tabs) {
    if (!(await pathExists(root, tab.renderIf))) {
      continue;
    }

    links.push({
      id: tab.key,
      href: `/cases/${caseId}/${tab.key}`,
      text: idToText(tab.key),
    });
  }

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

export const buildBanner = async (root) => {
  const [bannerJson] = JSONPath({
    json: root.workflow,
    path: "$.pages.cases.details.banner",
  });

  const banner = await resolveJSONPath({ root, path: bannerJson });

  addCallToActionToBanner(banner, root.externalActions);

  return banner;
};
