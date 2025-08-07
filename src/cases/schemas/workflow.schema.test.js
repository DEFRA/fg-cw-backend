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

    describe("field validation", () => {
      it("accepts valid field type from typeSchema", () => {
        const data = structuredClone(workflowData1);
        data.pages.cases.details.tabs.caseDetails.sections[0].fields[0].type =
          "string";

        const { error } = WorkflowData.validate(data);
        expect(error).toBeUndefined();
      });

      it("rejects invalid field type", () => {
        const data = structuredClone(workflowData1);
        data.pages.cases.details.tabs.caseDetails.sections[0].fields[0].type =
          "invalid";

        const { error } = WorkflowData.validate(data);
        expect(error.name).toEqual("ValidationError");
        expect(error.details[0].message).toEqual(
          '"pages.cases.details.tabs.caseDetails.sections[0].fields[0].type" must be one of [string, number, boolean, date, object, array]',
        );
      });

      it("accepts optional field format", () => {
        const data = structuredClone(workflowData1);
        data.pages.cases.details.tabs.caseDetails.sections[0].fields[0].format =
          "date";

        const { error } = WorkflowData.validate(data);
        expect(error).toBeUndefined();
      });
    });

    describe("section validation", () => {
      it("accepts valid section type object", () => {
        const data = structuredClone(workflowData1);
        data.pages.cases.details.tabs.caseDetails.sections[0].type = "object";

        const { error } = WorkflowData.validate(data);
        expect(error).toBeUndefined();
      });

      it("accepts valid section type array", () => {
        const data = structuredClone(workflowData1);
        data.pages.cases.details.tabs.caseDetails.sections[0].type = "array";

        const { error } = WorkflowData.validate(data);
        expect(error).toBeUndefined();
      });

      it("rejects invalid section type", () => {
        const data = structuredClone(workflowData1);
        data.pages.cases.details.tabs.caseDetails.sections[0].type = "string";

        const { error } = WorkflowData.validate(data);
        expect(error.name).toEqual("ValidationError");
        expect(error.details[0].message).toEqual(
          '"pages.cases.details.tabs.caseDetails.sections[0].type" must be one of [object, array]',
        );
      });

      it("requires section component", () => {
        const data = structuredClone(workflowData1);
        delete data.pages.cases.details.tabs.caseDetails.sections[0].component;

        const { error } = WorkflowData.validate(data);
        expect(error.name).toEqual("ValidationError");
        expect(error.details[0].message).toEqual(
          '"pages.cases.details.tabs.caseDetails.sections[0].component" is required',
        );
      });

      it("accepts valid component types", () => {
        const data = structuredClone(workflowData1);
        data.pages.cases.details.tabs.caseDetails.sections[0].component =
          "table";

        const { error } = WorkflowData.validate(data);
        expect(error).toBeUndefined();
      });

      it("rejects invalid component type", () => {
        const data = structuredClone(workflowData1);
        data.pages.cases.details.tabs.caseDetails.sections[0].component =
          "invalid";

        const { error } = WorkflowData.validate(data);
        expect(error.name).toEqual("ValidationError");
        expect(error.details[0].message).toEqual(
          '"pages.cases.details.tabs.caseDetails.sections[0].component" must be one of [list, table]',
        );
      });
    });
  });
});
