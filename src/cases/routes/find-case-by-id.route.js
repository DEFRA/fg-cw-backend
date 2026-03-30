import Joi from "joi";
import { createPageResponse } from "../../common/create-page-response.js";
import { findCaseByIdUseCase } from "../use-cases/find-case-by-id.use-case.js";
import { findCaseSeries } from "../use-cases/find-case-series.use-case.js";

const constructLinksForCaseSeries = (links, caseSeriesLength) => {
  if (caseSeriesLength > 1) {
    const newLinks = links.map((link) => {
      if (link.id === "timeline") {
        const timelineLink = {
          ...link,
          text: `Timeline (${caseSeriesLength})`,
        };
        return timelineLink;
      }
      return link;
    });
    return newLinks;
  }

  return links;
};

export const findCaseByIdRoute = {
  method: "GET",
  path: "/cases/{caseId}",
  options: {
    description: "Find a case by id",
    tags: ["api"],
    validate: {
      params: Joi.object({
        caseId: Joi.string().hex().length(24),
      }),
    },
  },
  async handler(request) {
    const { caseId } = request.params;
    const tabId = request.query.tabId;
    const { user } = request.auth.credentials;

    const data = await findCaseByIdUseCase(caseId, user, {
      params: { caseId, tabId },
    });

    const caseSeries = await findCaseSeries({
      tabId,
      caseRef: data.caseRef,
      workflowCode: data.workflowCode,
    });

    const links = constructLinksForCaseSeries(data.links, caseSeries.length);
    return createPageResponse({ user, data: { ...data, links, caseSeries } });
  },
};
