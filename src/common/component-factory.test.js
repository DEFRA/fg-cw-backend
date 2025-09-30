import { describe, expect, it } from "vitest";
import {
  camelCaseToTitleCase,
  createContainerComponent,
  createHeadingComponent,
  createListComponent,
  createSimpleComponent,
  createTableComponent,
  createTextComponent,
  isObject,
  processTableCellValue,
} from "./component-factory.js";

describe("component-factory", () => {
  describe("camelCaseToTitleCase", () => {
    it("converts camelCase to Title Case", () => {
      expect(camelCaseToTitleCase("firstName")).toBe("First Name");
      expect(camelCaseToTitleCase("lastLoginDate")).toBe("Last Login Date");
      expect(camelCaseToTitleCase("isUserActive")).toBe("Is User Active");
    });

    it("handles single words", () => {
      expect(camelCaseToTitleCase("name")).toBe("Name");
      expect(camelCaseToTitleCase("age")).toBe("Age");
    });

    it("handles empty strings and edge cases", () => {
      expect(camelCaseToTitleCase("")).toBe("");
      expect(camelCaseToTitleCase()).toBe("");
      expect(camelCaseToTitleCase("a")).toBe("A");
    });

    it("handles strings with numbers", () => {
      expect(camelCaseToTitleCase("user2Name")).toBe("User2Name");
      expect(camelCaseToTitleCase("version1Point2")).toBe("Version1Point2");
    });
  });

  describe("isObject", () => {
    it("returns true for plain objects", () => {
      expect(isObject({})).toBe(true);
      expect(isObject({ name: "test" })).toBe(true);
    });

    it("returns false for arrays", () => {
      expect(isObject([])).toBe(false);
      expect(isObject([1, 2, 3])).toBe(false);
    });

    it("returns false for null and undefined", () => {
      expect(isObject(null)).toBe(false);
      expect(isObject(undefined)).toBe(false);
    });

    it("returns false for primitives", () => {
      expect(isObject("string")).toBe(false);
      expect(isObject(123)).toBe(false);
      expect(isObject(true)).toBe(false);
    });
  });

  describe("createTextComponent", () => {
    it("creates a basic text component", () => {
      const result = createTextComponent({
        id: "testKey",
        value: "test value",
      });

      expect(result).toEqual({
        id: "testKey",
        component: "text",
        text: "test value",
        type: "string",
        label: "Test Key",
      });
    });

    it("accepts additional parameters", () => {
      const result = createTextComponent({
        id: "testKey",
        value: true,
        format: "yesNo",
        type: "boolean",
      });

      expect(result).toEqual({
        id: "testKey",
        component: "text",
        text: true,
        type: "boolean",
        label: "Test Key",
        format: "yesNo",
      });
    });

    it("overrides type when provided in params", () => {
      const result = createTextComponent({
        id: "testKey",
        value: "2025-01-01",
        type: "date",
        format: "formatDate",
      });

      expect(result).toEqual({
        id: "testKey",
        component: "text",
        text: "2025-01-01",
        type: "date",
        label: "Test Key",
        format: "formatDate",
      });
    });
  });

  describe("createListComponent", () => {
    it("creates a list component", () => {
      const obj = { name: "John", age: 30 };

      const result = createListComponent({
        id: "userInfo",
        obj,
      });

      expect(result).toEqual({
        id: "userInfo",
        component: "summary-list",
        title: "User Info",
        type: "object",
        rows: [
          {
            id: "name",
            component: "text",
            text: "John",
            type: "string",
            label: "Name",
          },
          {
            id: "age",
            component: "text",
            text: 30,
            type: "number",
            label: "Age",
          },
        ],
      });
    });
  });

  describe("createTableComponent", () => {
    it("creates a table component", () => {
      const array = [
        { name: "John", age: 30 },
        { name: "Jane", age: 25 },
      ];

      const result = createTableComponent({
        id: "users",
        array,
      });

      expect(result).toEqual({
        id: "users",
        component: "table",
        label: "Users",
        title: "Users",
        type: "array",
        rows: [
          [
            {
              id: "name",
              component: "text",
              text: "John",
              type: "string",
              label: "Name",
            },
            {
              id: "age",
              component: "text",
              text: 30,
              type: "number",
              label: "Age",
            },
          ],
          [
            {
              id: "name",
              component: "text",
              text: "Jane",
              type: "string",
              label: "Name",
            },
            {
              id: "age",
              component: "text",
              text: 25,
              type: "number",
              label: "Age",
            },
          ],
        ],
      });
    });
  });

  describe("createContainerComponent", () => {
    it("creates a container component", () => {
      const itemValue = { unit: "ha", quantity: 10.5 };

      const result = createContainerComponent({ id: "appliedFor", itemValue });

      expect(result).toEqual({
        id: "appliedFor",
        component: "container",
        label: "Applied For",
        items: [
          { text: "ha", type: "string" },
          { text: 10.5, type: "number" },
        ],
      });
    });
  });

  describe("createHeadingComponent", () => {
    it("creates a heading component with default level", () => {
      const result = createHeadingComponent({
        id: "title",
        text: "Application",
      });

      expect(result).toEqual({
        id: "title",
        component: "heading",
        text: "Application",
        level: 2,
      });
    });

    it("creates a heading component with custom level", () => {
      const result = createHeadingComponent({
        id: "subtitle",
        text: "Section Title",
        level: 3,
      });

      expect(result).toEqual({
        id: "subtitle",
        component: "heading",
        text: "Section Title",
        level: 3,
      });
    });
  });

  describe("createSimpleComponent", () => {
    it("creates a text component for strings", () => {
      const result = createSimpleComponent("name", "John");

      expect(result).toEqual({
        id: "name",
        component: "text",
        text: "John",
        type: "string",
        label: "Name",
      });
    });

    it("creates a date component for date strings", () => {
      const result = createSimpleComponent("createdDate", "2025-01-01");

      expect(result).toEqual({
        id: "createdDate",
        component: "text",
        text: "2025-01-01",
        type: "date",
        label: "Created Date",
        format: "formatDate",
      });
    });

    it("creates a boolean component for booleans", () => {
      const result = createSimpleComponent("isActive", true);

      expect(result).toEqual({
        id: "isActive",
        component: "text",
        text: true,
        type: "boolean",
        label: "Is Active",
        format: "yesNo",
      });
    });
  });

  describe("processTableCellValue", () => {
    it("processes arrays as table components", () => {
      const result = processTableCellValue("items", [{ id: 1, name: "Item" }]);

      expect(result).toEqual({
        id: "items",
        component: "table",
        label: "Items",
        title: "Items",
        type: "array",
        rows: [
          [
            {
              id: "id",
              component: "text",
              text: 1,
              type: "number",
              label: "Id",
            },
            {
              id: "name",
              component: "text",
              text: "Item",
              type: "string",
              label: "Name",
            },
          ],
        ],
      });
    });

    it("processes objects as container components", () => {
      const result = processTableCellValue("details", {
        unit: "ha",
        quantity: 10.5,
      });

      expect(result).toEqual({
        id: "details",
        component: "container",
        label: "Details",
        items: [
          { text: "ha", type: "string" },
          { text: 10.5, type: "number" },
        ],
      });
    });

    it("processes primitives as simple components", () => {
      const result = processTableCellValue("count", 42);

      expect(result).toEqual({
        id: "count",
        component: "text",
        text: 42,
        type: "number",
        label: "Count",
      });
    });
  });
});
