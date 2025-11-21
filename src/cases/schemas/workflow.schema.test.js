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

    it("requires tab content if data exists", () => {
      const data = structuredClone(workflowData1);
      delete data.pages.cases.details.tabs["case-details"].content;

      const { error } = WorkflowData.validate(data);
      expect(error.name).toEqual("ValidationError");
      expect(error.details[0].message).toEqual(
        '"pages.cases.details.tabs.case-details.content" is required',
      );
    });

    it("requires at least one content component in tab", () => {
      const data = structuredClone(workflowData1);
      data.pages.cases.details.tabs["case-details"].content = [];

      const { error } = WorkflowData.validate(data);
      expect(error.name).toEqual("ValidationError");
      expect(error.details[0].message).toEqual(
        '"pages.cases.details.tabs.case-details.content" must contain at least 1 items',
      );
    });

    describe("content validation", () => {
      it("accepts valid content type object", () => {
        const data = structuredClone(workflowData1);
        data.pages.cases.details.tabs["case-details"].content[2].type =
          "object";

        const { error } = WorkflowData.validate(data);
        expect(error).toBeUndefined();
      });

      it("accepts valid content type array", () => {
        const data = structuredClone(workflowData1);
        data.pages.cases.details.tabs["case-details"].content[0].type = "array";

        const { error } = WorkflowData.validate(data);
        expect(error).toBeUndefined();
      });
    });

    describe("externalActions validation", () => {
      it("accepts valid externalActions array", () => {
        const data = structuredClone(workflowData1);
        data.externalActions = [
          {
            code: "RERUN_RULES",
            name: "Rerun Rules",
            description: "Rerun the business rules validation",
            endpoint: "landGrantsRulesRerun",
            target: {
              position: "PRE_AWARD:REVIEW_APPLICATION:IN_PROGRESS",
              node: "landGrantsRulesRun",
              nodeType: "array",
              place: "append",
            },
          },
        ];

        const { error } = WorkflowData.validate(data);
        expect(error).toBeUndefined();
      });

      it("accepts workflow without externalActions (optional field)", () => {
        const data = structuredClone(workflowData1);
        // externalActions is not defined

        const { error } = WorkflowData.validate(data);
        expect(error).toBeUndefined();
      });

      it("accepts externalActions without optional description field", () => {
        const data = structuredClone(workflowData1);
        data.externalActions = [
          {
            code: "RERUN_RULES",
            name: "Rerun Rules",
            endpoint: "landGrantsRulesRerun",
            target: {
              position: "PRE_AWARD:REVIEW_APPLICATION:IN_PROGRESS",
              node: "landGrantsRulesRun",
              nodeType: "array",
            },
          },
        ];

        const { error } = WorkflowData.validate(data);
        expect(error).toBeUndefined();
      });

      it("requires code field in externalAction", () => {
        const data = structuredClone(workflowData1);
        data.externalActions = [
          {
            name: "Rerun Rules",
            endpoint: "landGrantsRulesRerun",
            target: {
              position: "PRE_AWARD:REVIEW_APPLICATION:IN_PROGRESS",
              node: "landGrantsRulesRun",
              nodeType: "array",
            },
          },
        ];

        const { error } = WorkflowData.validate(data);
        expect(error.name).toEqual("ValidationError");
        expect(error.details[0].message).toEqual(
          '"externalActions[0].code" is required',
        );
      });

      it("requires name field in externalAction", () => {
        const data = structuredClone(workflowData1);
        data.externalActions = [
          {
            code: "RERUN_RULES",
            endpoint: "landGrantsRulesRerun",
            target: {
              position: "PRE_AWARD:REVIEW_APPLICATION:IN_PROGRESS",
              node: "landGrantsRulesRun",
              nodeType: "array",
            },
          },
        ];

        const { error } = WorkflowData.validate(data);
        expect(error.name).toEqual("ValidationError");
        expect(error.details[0].message).toEqual(
          '"externalActions[0].name" is required',
        );
      });

      it("requires endpoint field in externalAction", () => {
        const data = structuredClone(workflowData1);
        data.externalActions = [
          {
            code: "RERUN_RULES",
            name: "Rerun Rules",
            target: {
              position: "PRE_AWARD:REVIEW_APPLICATION:IN_PROGRESS",
              node: "landGrantsRulesRun",
              nodeType: "array",
            },
          },
        ];

        const { error } = WorkflowData.validate(data);
        expect(error.name).toEqual("ValidationError");
        expect(error.details[0].message).toEqual(
          '"externalActions[0].endpoint" is required',
        );
      });

      it("requires target field in externalAction", () => {
        const data = structuredClone(workflowData1);
        data.externalActions = [
          {
            code: "RERUN_RULES",
            name: "Rerun Rules",
            endpoint: "landGrantsRulesRerun",
          },
        ];

        const { error } = WorkflowData.validate(data);
        expect(error.name).toEqual("ValidationError");
        expect(error.details[0].message).toEqual(
          '"ExternalActionTarget" is required',
        );
      });

      it("requires node field in target", () => {
        const data = structuredClone(workflowData1);
        data.externalActions = [
          {
            code: "RERUN_RULES",
            name: "Rerun Rules",
            endpoint: "landGrantsRulesRerun",
            target: {
              position: "PRE_AWARD:REVIEW_APPLICATION:IN_PROGRESS",
              nodeType: "array",
            },
          },
        ];

        const { error } = WorkflowData.validate(data);
        expect(error.name).toEqual("ValidationError");
        expect(error.details[0].message).toEqual(
          '"externalActions[0].target.node" is required',
        );
      });

      it("requires nodeType field in target", () => {
        const data = structuredClone(workflowData1);
        data.externalActions = [
          {
            code: "RERUN_RULES",
            name: "Rerun Rules",
            endpoint: "landGrantsRulesRerun",
            target: {
              position: "PRE_AWARD:REVIEW_APPLICATION:IN_PROGRESS",
              node: "landGrantsRulesRun",
            },
          },
        ];

        const { error } = WorkflowData.validate(data);
        expect(error.name).toEqual("ValidationError");
        expect(error.details[0].message).toEqual(
          '"externalActions[0].target.nodeType" is required',
        );
      });

      it("validates nodeType must be 'array'", () => {
        const data = structuredClone(workflowData1);
        data.externalActions = [
          {
            code: "RERUN_RULES",
            name: "Rerun Rules",
            endpoint: "landGrantsRulesRerun",
            target: {
              position: "PRE_AWARD:REVIEW_APPLICATION:IN_PROGRESS",
              node: "landGrantsRulesRun",
              nodeType: "object",
            },
          },
        ];

        const { error } = WorkflowData.validate(data);
        expect(error.name).toEqual("ValidationError");
        expect(error.details[0].message).toEqual(
          '"externalActions[0].target.nodeType" must be [array]',
        );
      });

      it("requires position field in target", () => {
        const data = structuredClone(workflowData1);
        data.externalActions = [
          {
            code: "RERUN_RULES",
            name: "Rerun Rules",
            endpoint: "landGrantsRulesRerun",
            target: {
              node: "landGrantsRulesRun",
              nodeType: "array",
            },
          },
        ];

        const { error } = WorkflowData.validate(data);
        expect(error.name).toEqual("ValidationError");
        expect(error.details[0].message).toEqual(
          '"externalActions[0].target.position" is required',
        );
      });

      it("validates place must be 'append' if provided", () => {
        const data = structuredClone(workflowData1);
        data.externalActions = [
          {
            code: "RERUN_RULES",
            name: "Rerun Rules",
            endpoint: "landGrantsRulesRerun",
            target: {
              position: "PRE_AWARD:REVIEW_APPLICATION:IN_PROGRESS",
              node: "landGrantsRulesRun",
              nodeType: "array",
              place: "prepend",
            },
          },
        ];

        const { error } = WorkflowData.validate(data);
        expect(error.name).toEqual("ValidationError");
        expect(error.details[0].message).toEqual(
          '"externalActions[0].target.place" must be [append]',
        );
      });

      it("accepts multiple externalActions", () => {
        const data = structuredClone(workflowData1);
        data.externalActions = [
          {
            code: "RERUN_RULES",
            name: "Rerun Rules",
            endpoint: "landGrantsRulesRerun",
            target: {
              position: "PRE_AWARD:REVIEW_APPLICATION:IN_PROGRESS",
              node: "landGrantsRulesRun",
              nodeType: "array",
              place: "append",
            },
          },
          {
            code: "ANOTHER_ACTION",
            name: "Another Action",
            endpoint: "anotherEndpoint",
            target: {
              position: "POST_AWARD:FINAL_REVIEW:COMPLETED",
              node: "anotherNode",
              nodeType: "array",
            },
          },
        ];

        const { error } = WorkflowData.validate(data);
        expect(error).toBeUndefined();
      });
    });

    describe("endpoints validation", () => {
      it("accepts valid endpoints array", () => {
        const data = structuredClone(workflowData1);
        data.endpoints = [
          {
            code: "FETCH_RULES_ENDPOINT",
            service: "RULES_ENGINE",
            path: "/applications/{runId}",
            method: "GET",
            request: null,
          },
        ];

        const { error } = WorkflowData.validate(data);
        expect(error).toBeUndefined();
      });

      it("requires service when endpoints are provided", () => {
        const data = structuredClone(workflowData1);
        data.endpoints = [
          {
            code: "FETCH_RULES_ENDPOINT",
            path: "/applications/{runId}",
            method: "GET",
          },
        ];

        const { error } = WorkflowData.validate(data);
        expect(error.name).toEqual("ValidationError");
        expect(error.details[0].message).toEqual(
          '"endpoints[0].service" is required',
        );
      });
    });
  });
});
