import { describe, expect, it } from "vitest";
import { buildDynamicContent } from "./build-dynamic-content.js";

describe("buildDynamicContent", () => {
  it("filters out excluded keys", () => {
    const payload = {
      clientRef: "123",
      code: "test-code",
      identifiers: { id: "456" },
      createdAt: "2025-01-01",
      submittedAt: "2025-01-02",
      answers: { name: "John", age: 30 },
    };

    const result = buildDynamicContent(payload);

    const EXCLUDED_KEYS = [
      "clientRef",
      "code",
      "identifiers",
      "createdAt",
      "submittedAt",
    ];

    const ids = result.map((c) => c.id);

    EXCLUDED_KEYS.forEach((key) => {
      expect(ids).not.toContain(key);
    });

    // Should contain components for non-excluded keys
    const answersComponent = result.find((comp) => comp.id === "answers");
    expect(answersComponent).toBeDefined();
  });

  it("includes default heading as first component", () => {
    const payload = { name: "test" };

    const result = buildDynamicContent(payload);

    expect(result[0]).toEqual({
      id: "title",
      component: "heading",
      text: "Application",
      level: 2,
    });
  });

  it("handles null and undefined values correctly", () => {
    const payload = {
      field1: null,
      field2: undefined,
      field3: "valid value",
      field4: 0,
      field5: false,
      field6: "",
    };

    const result = buildDynamicContent(payload);

    // Should filter out null and undefined
    const nullComponent = result.find((comp) => comp.id === "field1");
    const undefinedComponent = result.find((comp) => comp.id === "field2");
    expect(nullComponent).toBeUndefined();
    expect(undefinedComponent).toBeUndefined();

    // Should include falsy but valid values
    const zeroComponent = result.find((comp) => comp.id === "field4");
    const falseComponent = result.find((comp) => comp.id === "field5");
    const emptyStringComponent = result.find((comp) => comp.id === "field6");
    expect(zeroComponent).toBeDefined();
    expect(falseComponent).toBeDefined();
    expect(emptyStringComponent).toBeDefined();

    // Should include valid value
    const validComponent = result.find((comp) => comp.id === "field3");
    expect(validComponent).toBeDefined();
  });

  it("formats boolean values with yesNo format", () => {
    const payload = {
      isActive: true,
      isCompleted: false,
    };

    const result = buildDynamicContent(payload);

    const booleanComponents = result.filter((comp) => comp.format === "yesNo");
    expect(booleanComponents).toHaveLength(2);

    const activeComponent = result.find((comp) => comp.id === "isActive");
    expect(activeComponent).toEqual({
      id: "isActive",
      component: "text",
      text: true,
      type: "boolean",
      label: "Is Active",
      format: "yesNo",
    });
  });

  it("formats date strings with formatDate format", () => {
    const payload = {
      createdDate: "2025-09-11T10:07:55.071Z",
      simpleDate: "2025-09-11",
    };

    const result = buildDynamicContent(payload);

    const dateComponents = result.filter(
      (comp) => comp.format === "formatDate",
    );
    expect(dateComponents).toHaveLength(2);

    const createdDateComponent = result.find(
      (comp) => comp.id === "createdDate",
    );
    expect(createdDateComponent).toEqual({
      id: "createdDate",
      component: "text",
      text: "2025-09-11T10:07:55.071Z",
      type: "date",
      label: "Created Date",
      format: "formatDate",
    });
  });

  it("processes regular text values without special formatting", () => {
    const payload = {
      name: "John Doe",
      count: 42,
      description: "Test description",
    };

    const result = buildDynamicContent(payload);

    const textComponents = result.filter(
      (comp) => comp.component === "text" && !comp.format,
    );
    expect(textComponents).toHaveLength(3);

    const nameComponent = result.find((comp) => comp.id === "name");
    expect(nameComponent).toEqual({
      id: "name",
      component: "text",
      text: "John Doe",
      type: "string",
      label: "Name",
    });
  });

  it("converts camelCase to Title Case for labels", () => {
    const payload = {
      firstName: "John",
      lastLoginDate: "2025-09-11T10:07:55.071Z",
      isUserActive: true,
    };

    const result = buildDynamicContent(payload);

    const firstNameComponent = result.find((comp) => comp.id === "firstName");
    const lastLoginComponent = result.find(
      (comp) => comp.id === "lastLoginDate",
    );
    const isUserActiveComponent = result.find(
      (comp) => comp.id === "isUserActive",
    );

    expect(firstNameComponent.label).toBe("First Name");
    expect(lastLoginComponent.label).toBe("Last Login Date");
    expect(isUserActiveComponent.label).toBe("Is User Active");
  });

  it("creates table components for arrays of objects", () => {
    const payload = {
      items: [
        { name: "Item1", value: 10 },
        { name: "Item2", value: 20 },
      ],
    };

    const result = buildDynamicContent(payload);

    const tableComponent = result.find((comp) => comp.component === "table");
    expect(tableComponent).toBeDefined();
    expect(tableComponent.id).toBe("items");
    expect(tableComponent.title).toBe("Items");
    expect(tableComponent.type).toBe("array");
    expect(Array.isArray(tableComponent.rows)).toBe(true);
    expect(tableComponent.rows).toHaveLength(2);
  });

  it("creates list components for objects with simple properties", () => {
    const payload = {
      user: {
        name: "John Doe",
        age: 30,
        isActive: true,
      },
    };

    const result = buildDynamicContent(payload);

    const listComponent = result.find(
      (comp) => comp.component === "summary-list",
    );
    expect(listComponent).toBeDefined();
    expect(listComponent.id).toBe("user");
    expect(listComponent.title).toBe("User");
    expect(listComponent.type).toBe("object");
    expect(Array.isArray(listComponent.rows)).toBe(true);
    expect(listComponent.rows).toHaveLength(3);
  });

  it("handles mixed simple and complex properties in objects", () => {
    const payload = {
      user: {
        name: "John Doe",
        age: 30,
        addresses: [{ city: "London" }],
        settings: { theme: "dark" },
      },
    };

    const result = buildDynamicContent(payload);

    // Should create list component for simple props (name, age)
    const listComponent = result.find(
      (comp) => comp.component === "summary-list",
    );
    expect(listComponent).toBeDefined();
    expect(listComponent.rows).toHaveLength(2); // name, age

    // Should create separate components for complex props (addresses, settings)
    const tableComponent = result.find((comp) => comp.component === "table");
    expect(tableComponent).toBeDefined();
  });

  it("filters out empty arrays", () => {
    const payload = {
      items: [],
      validItems: [{ name: "Item1" }],
    };

    const result = buildDynamicContent(payload);

    // Should not create a component for empty array
    const emptyTableComponent = result.find((comp) => comp.id === "items");
    expect(emptyTableComponent).toBeUndefined();

    // Should create a component for non-empty array
    const validTableComponent = result.find((comp) => comp.id === "validItems");
    expect(validTableComponent).toBeDefined();
    expect(validTableComponent.component).toBe("table");
  });

  it("handles complex FRPS-style payload structure", () => {
    const realPayload = {
      answers: {
        hasCheckedLandIsUpToDate: true,
        scheme: "SFI",
        year: 2025,
        actionApplications: [
          {
            code: "CMOR1",
            sheetId: "SD6843",
            parcelId: "9485",
            appliedFor: {
              unit: "ha",
              quantity: 0.14472089,
            },
          },
          {
            code: "UPL1",
            sheetId: "SD6843",
            parcelId: "9485",
            appliedFor: {
              unit: "ha",
              quantity: 0.14472089,
            },
          },
        ],
        payment: {
          agreementStartDate: "2025-10-01",
          agreementEndDate: "2028-10-01",
          frequency: "Quarterly",
          agreementTotalPence: 111407,
        },
      },
      applicant: {
        business: {
          name: "J&S Hartley",
          email: {
            address: "test@example.com",
          },
        },
      },
    };

    const result = buildDynamicContent(realPayload);

    // Should generate multiple components
    expect(result.length).toBeGreaterThan(3);

    // Should have heading
    expect(result[0].component).toBe("heading");

    // Should handle nested structures
    const hasTable = result.some((comp) => comp.component === "table");
    const hasList = result.some((comp) => comp.component === "summary-list");
    expect(hasTable).toBe(true);
    expect(hasList).toBe(true);

    // Should process date strings in nested objects
    const hasDateFormatting = JSON.stringify(result).includes('"formatDate"');
    expect(hasDateFormatting).toBe(true);

    // Should process boolean values
    const hasBooleanFormatting = JSON.stringify(result).includes('"yesNo"');
    expect(hasBooleanFormatting).toBe(true);
  });

  it("handles empty payload", () => {
    const result = buildDynamicContent({});

    // Should only contain the default heading
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "title",
      component: "heading",
      text: "Application",
      level: 2,
    });
  });

  it("handles payload with only null values", () => {
    const payload = {
      field1: null,
      field2: null,
      field3: undefined,
    };

    const result = buildDynamicContent(payload);

    // Should only contain the default heading
    expect(result).toHaveLength(1);
    expect(result[0].component).toBe("heading");
  });

  it("handles nested objects with null values", () => {
    const payload = {
      user: {
        name: "John",
        address: null,
        phone: undefined,
        age: 30,
      },
    };

    const result = buildDynamicContent(payload);

    const listComponent = result.find(
      (comp) => comp.component === "summary-list",
    );
    expect(listComponent).toBeDefined();
    // Note: null/undefined filtering only happens at top level, nested objects include all properties
    expect(listComponent.rows).toHaveLength(4);

    // Verify the null and undefined values are still included but with appropriate types
    const addressRow = listComponent.rows.find((row) => row.id === "address");
    const phoneRow = listComponent.rows.find((row) => row.id === "phone");
    expect(addressRow.text).toBe(null);
    expect(phoneRow.type).toBe("undefined");
  });

  it("handles invalid date strings as regular text", () => {
    const payload = {
      validDate: "2025-09-11T10:07:55.071Z",
      invalidDate: "not-a-date",
      almostDate: "2025-13-45", // invalid month/day
    };

    const result = buildDynamicContent(payload);

    const validDateComp = result.find((comp) => comp.id === "validDate");
    const invalidDateComp = result.find((comp) => comp.id === "invalidDate");
    const almostDateComp = result.find((comp) => comp.id === "almostDate");

    expect(validDateComp.format).toBe("formatDate");
    expect(invalidDateComp.format).toBeUndefined();
    expect(almostDateComp.format).toBeUndefined();
  });
});
