import { JSONPath } from "jsonpath-plus";
import { resolveJSONPath } from "./resolve-json.js";

export const createRootContext = (kase, workflow) => ({
  ...kase,
  definitions: { ...workflow.definitions },
});

export const shouldRender = (root, item) => {
  if (item?.renderIf) {
    return Boolean(resolveJSONPath({ root, path: item.renderIf }));
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
