import { describe, expect, it } from "vitest";
import { auditActions, buildAuditSecurity } from "./audit-constants.js";

describe("pmc codes", () => {
  // The audit publisher requires a code, so an action without one fails
  // validation and rolls back whatever it audits.
  it.each(Object.values(auditActions))("has a code for %s", (action) => {
    expect(buildAuditSecurity(action).pmccode).toMatch(/^\d{4}$/);
  });

  it("files a payload edit as an action a user or service can execute", () => {
    expect(buildAuditSecurity(auditActions.EDIT_EVENT_PAYLOAD)).toEqual({
      pmccode: "0706",
    });
  });

  it.each([auditActions.FIND_CASES, auditActions.VIEW_CASE_DATA])(
    "files %s as an action a user or service can execute",
    (action) => {
      expect(buildAuditSecurity(action)).toEqual({ pmccode: "0706" });
    },
  );
});
