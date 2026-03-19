import Boom from "@hapi/boom";
import { JSONPath } from "jsonpath-plus";
import { IdpRoles } from "../users/models/idp-roles.js";
import { AccessControl } from "./access-control.js";
import { populateUrlTemplate, resolveJSONPath } from "./resolve-json.js";

export const createCaseWorkflowContext = ({
  kase,
  workflow,
  request = {},
  user = null,
}) => {
  const status = workflow.getStatus(kase.position);

  return {
    ...kase,
    workflow,
    definitions: { ...workflow.definitions },
    templates: getWorkflowTemplates(workflow),
    currentStatusName: status.name,
    ...(workflow.externalActions && {
      externalActions: workflow.externalActions.filter(
        (action) => action.display === true,
      ),
    }),
    request: { ...request },
    user,
  };
};

const getWorkflowTemplates = (workflow) => {
  return workflow.templates || {};
};

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
      index: 0,
    },
    {
      id: "case-details",
      href: `/cases/${caseId}/case-details`,
      text: "Application",
      index: 1,
    },
    {
      id: "notes",
      href: `/cases/${caseId}/notes`,
      text: "Notes",
      index: 4,
    },
    {
      id: "timeline",
      href: `/cases/${caseId}/timeline`,
      text: "Timeline",
      index: 3,
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

    const linkData = tab.link || {};
    let href = `/cases/${caseId}/${tab.key}`;

    if (linkData.href?.urlTemplate) {
      const template = await resolveJSONPath({
        root,
        path: linkData.href.urlTemplate,
      });
      const params = await resolveJSONPath({
        root,
        path: linkData.href.params || {},
      });
      href = populateUrlTemplate(template, params);
    }

    links.push({
      id: tab.key,
      href,
      text: linkData.text || idToText(tab.key),
      index: linkData.index,
    });
  }

  // Sort all links by index, placing links without index at the end
  links.sort(
    (a, b) =>
      (a.index ?? Number.MAX_SAFE_INTEGER) -
      (b.index ?? Number.MAX_SAFE_INTEGER),
  );

  return links;
};

const idToText = (segment) => {
  return segment
    .split("-") // split into words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1)) // capitalise first letter
    .join(" "); // join back with spaces
};

const addCallToActionToBanner = (banner, root) => {
  if (hasExternalActions(banner, root) && canCallExternalActions(root)) {
    const callToAction = root.externalActions.map((action) => ({
      code: action.code,
      name: action.name,
    }));
    return { ...banner, callToAction };
  } else {
    return banner;
  }
};

export const buildBanner = async (root) => {
  const [bannerJson] = JSONPath({
    json: root.workflow,
    path: "$.pages.cases.details.banner",
  });

  const banner = await resolveJSONPath({ root, path: bannerJson });

  return addCallToActionToBanner(banner, root);
};

const hasExternalActions = (banner, root) => {
  return banner && root.externalActions && root.externalActions.length > 0;
};

const canCallExternalActions = (root) => {
  return AccessControl.canAccess(root.user, {
    idpRoles: [IdpRoles.ReadWrite],
    appRoles: root.workflow.requiredRoles,
  });
};
