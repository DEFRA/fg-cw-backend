const EXCLUDE_KEYS = [
  "clientRef",
  "code",
  "identifiers",
  "createdAt",
  "submittedAt",
];

export const buildDynamicContent = (payload) => {
  // create new payload object, filtering out excluded keys
  const filteredPayload = Object.fromEntries(
    Object.entries(payload).filter(([key]) => !EXCLUDE_KEYS.includes(key)),
  );

  const content = [
    {
      id: "title",
      component: "heading",
      text: "Application",
      level: 2,
    },
  ];

  Object.entries(filteredPayload).forEach(([key, value]) => {
    const components = processValue(key, value);
    content.push(...components);
  });

  return content;
};

// eslint-disable-next-line complexity
const processValue = (key, value) => {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return [createTableComponent(key, value)];
  }

  if (isObject(value)) {
    return processObject(key, value);
  }

  return [createSimpleComponent(key, value)];
};

const processObject = (key, obj) => {
  const components = [];
  const simpleProps = {};
  const complexProps = {};

  // Separate simple and complex properties
  Object.entries(obj).forEach(([objKey, objValue]) => {
    if (Array.isArray(objValue) || isObject(objValue)) {
      complexProps[objKey] = objValue;
    } else {
      simpleProps[objKey] = objValue;
    }
  });

  // If there are simple props, create a list component for them
  if (Object.keys(simpleProps).length > 0) {
    components.push(createListComponent(key, simpleProps));
  }

  // Process complex properties
  const complexComponents = processComplexProperties(key, complexProps);
  components.push(...complexComponents);

  return components;
};

const createSimpleComponent = (key, value) => {
  if (isDateString(value)) {
    return createTextComponent(key, value, {
      type: "date",
      format: "formatDate",
    });
  }

  if (typeof value === "boolean") {
    return createTextComponent(key, value, {
      type: "boolean",
      format: "yesNo",
    });
  }

  return createTextComponent(key, value);
};

const processComplexProperties = (key, complexProps) => {
  return Object.entries(complexProps).flatMap(([objKey, objValue]) => {
    const customTitle = createCustomTitle(objKey, key);
    const processedComponents = processValue(objKey, objValue);

    if (customTitle && processedComponents.length > 0) {
      return [
        { ...processedComponents[0], title: customTitle },
        ...processedComponents.slice(1),
      ];
    }
    return processedComponents;
  });
};

const createCustomTitle = (objKey, parentKey) => {
  const isNumericKey = !isNaN(objKey);
  const hasMeaningfulParent = parentKey && isNaN(parentKey);

  return isNumericKey && hasMeaningfulParent
    ? `${camelCaseToTitleCase(parentKey)} ${objKey}`
    : null;
};

const isDateString = (value) => {
  if (typeof value !== "string") {
    return false;
  }

  const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;

  if (!isoDateRegex.test(value)) {
    return false;
  }

  const date = new Date(value);
  return !isNaN(date.getTime());
};

const isObject = (value) => {
  return value !== null && typeof value === "object" && !Array.isArray(value);
};

const camelCaseToTitleCase = (str = "") => {
  return (
    str
      // insert a space before any uppercase letter
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      // uppercase the first character of each word
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim()
  );
};

const createTextComponent = (key, value, params = {}) => {
  return {
    id: key,
    component: "text",
    text: value,
    type: typeof value,
    label: camelCaseToTitleCase(key),
    ...params,
  };
};

const createListComponent = (key, obj) => {
  const rows = Object.entries(obj).map(([objKey, objValue]) =>
    createSimpleComponent(objKey, objValue),
  );

  return {
    id: key,
    component: "list",
    title: camelCaseToTitleCase(key),
    type: "object",
    rows,
  };
};

const createTableComponent = (key, array) => {
  const rows = array.map((item) => {
    return Object.entries(item).map(([itemKey, itemValue]) =>
      processTableCellValue(itemKey, itemValue),
    );
  });

  return {
    id: key,
    component: "table",
    label: camelCaseToTitleCase(key),
    title: camelCaseToTitleCase(key),
    type: "array",
    rows,
  };
};
const processTableCellValue = (itemKey, itemValue) => {
  if (Array.isArray(itemValue)) {
    return createTableComponent(itemKey, itemValue);
  }

  if (isObject(itemValue)) {
    return createContainerCell(itemKey, itemValue);
  }

  return createSimpleComponent(itemKey, itemValue);
};

const createContainerCell = (itemKey, itemValue) => {
  return {
    id: itemKey,
    component: "container",
    label: camelCaseToTitleCase(itemKey),
    items: Object.entries(itemValue).map(([, subValue]) => ({
      text: subValue,
      type: typeof subValue,
    })),
  };
};
