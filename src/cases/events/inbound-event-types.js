import { config } from "../../common/config.js";
import { caseRefsOf } from "../../events/case-refs.js";
import { INBOX, defineEventType } from "../../events/event-types.js";

const GAS = `cloud.defra.${config.get("cdpEnvironment")}.fg-gas-backend.`;

export const caseCreate = defineEventType({
  name: "CreateCase",
  sentAs: `${GAS}case.create`,
  boxes: [INBOX],
  refs: ({ data }) => {
    const { workflowCode, caseRef, previousCaseRef } = data ?? {};

    return [
      ...caseRefsOf(workflowCode, caseRef),
      ...caseRefsOf(workflowCode, previousCaseRef),
    ];
  },
});

export const caseUpdateStatus = defineEventType({
  name: "UpdateCaseStatus",
  sentAs: `${GAS}case.update.status`,
  boxes: [INBOX],
  refs: ({ data }) => caseRefsOf(data?.workflowCode, data?.caseRef),
});

export const configVersionUpdated = defineEventType({
  name: "ConfigVersionUpdated",
  sentAs: "config-version.updated",
  boxes: [INBOX],
});

export const claimSubmitted = defineEventType({
  name: "ClaimSubmitted",
  sentAs: `${GAS}claim.submitted`,
  boxes: [INBOX],
  refs: ({ data }) => caseRefsOf(data?.workflowCode, data?.caseRef),
});
