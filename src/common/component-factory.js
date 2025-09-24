import { isDateString } from "./date-helpers.js";

export const createTextComponent = ({ id, value, ...params }) => {
  return {
    id,
    component: "text",
    text: value,
    type: typeof value,
    label: camelCaseToTitleCase(id),
    ...params,
  };
};

export const createListComponent = ({ id, obj }) => {
  const rows = Object.entries(obj).map(([objKey, objValue]) =>
    createSimpleComponent(objKey, objValue),
  );

  return {
    id,
    component: "list",
    title: camelCaseToTitleCase(id),
    type: "object",
    rows,
  };
};

export const createTableComponent = ({ id, array }) => {
  const rows = array.map((item) => {
    return Object.entries(item).map(([itemKey, itemValue]) =>
      processTableCellValue(itemKey, itemValue),
    );
  });

  return {
    id,
    component: "table",
    label: camelCaseToTitleCase(id),
    title: camelCaseToTitleCase(id),
    type: "array",
    rows,
  };
};

export const createContainerComponent = ({ id, itemValue }) => {
  return {
    id,
    component: "container",
    label: camelCaseToTitleCase(id),
    items: Object.entries(itemValue).map(([, subValue]) => ({
      text: subValue,
      type: typeof subValue,
    })),
  };
};

export const createHeadingComponent = ({ id, text, level = 2 }) => {
  return {
    id,
    component: "heading",
    text,
    level,
  };
};

export const createSimpleComponent = (key, value) => {
  if (isDateString(value)) {
    return createTextComponent({
      id: key,
      value,
      type: "date",
      format: "formatDate",
    });
  }

  if (typeof value === "boolean") {
    return createTextComponent({
      id: key,
      value,
      type: "boolean",
      format: "yesNo",
    });
  }

  return createTextComponent({ id: key, value });
};

export const processTableCellValue = (itemKey, itemValue) => {
  if (Array.isArray(itemValue)) {
    return createTableComponent({
      id: itemKey,
      array: itemValue,
    });
  }

  if (isObject(itemValue)) {
    return createContainerComponent({ id: itemKey, itemValue });
  }

  return createSimpleComponent(itemKey, itemValue);
};

export const camelCaseToTitleCase = (str = "") => {
  return (
    str
      // insert a space before any uppercase letter
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      // uppercase the first character of each word
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim()
  );
};

export const isObject = (value) => {
  return value !== null && typeof value === "object" && !Array.isArray(value);
};
