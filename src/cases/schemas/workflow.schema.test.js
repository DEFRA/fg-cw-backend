import { describe, expect, it } from "vitest";
import { workflowData1 } from "../../../test/fixtures/workflow.js";
import { workflowSchema } from "./workflow.schema.js";

const { WorkflowData } = workflowSchema;

describe("workflowSchema", () => {
  describe("WorkflowData", () => {
    it("returns no error for valid workflow data", () => {
      const data = structuredClone(workflowData1);

      const { error } = WorkflowData.validate(data);

      expect(error).toBeUndefined();
    });

    it("requires tabs to exist in pages.cases.details", () => {
      const data = structuredClone(workflowData1);
      delete data.pages.cases.details.tabs;

      const { error } = WorkflowData.validate(data);
      expect(error.name).toEqual("ValidationError");
      expect(error.details[0].message).equal(
        '"pages.cases.details.tabs" is required',
      );
    });

    it("requires tab title if data exists", () => {
      const data = structuredClone(workflowData1);
      delete data.pages.cases.details.tabs.caseDetails.title;

      const { error } = WorkflowData.validate(data);
      expect(error.name).toEqual("ValidationError");
      expect(error.details[0].message).toEqual(
        '"pages.cases.details.tabs.caseDetails.title" is required',
      );
    });

    it("requires tab sections if data exists", () => {
      const data = structuredClone(workflowData1);
      delete data.pages.cases.details.tabs.caseDetails.sections;

      const { error } = WorkflowData.validate(data);
      expect(error.name).toEqual("ValidationError");
      expect(error.details[0].message).toEqual(
        '"pages.cases.details.tabs.caseDetails.sections" is required',
      );
    });

    it("requires at least one section in tab", () => {
      const data = structuredClone(workflowData1);
      data.pages.cases.details.tabs.caseDetails.sections = [];

      const { error } = WorkflowData.validate(data);
      expect(error.name).toEqual("ValidationError");
      expect(error.details[0].message).toEqual(
        '"pages.cases.details.tabs.caseDetails.sections" must contain at least 1 items',
      );
    });
  });
});
