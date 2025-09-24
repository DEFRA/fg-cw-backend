import {
  camelCaseToTitleCase,
  createHeadingComponent,
  createListComponent,
  createSimpleComponent,
  createTableComponent,
  isObject,
} from "./component-factory.js";

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
    createHeadingComponent({ id: "title", text: "Application", level: 2 }),
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
    if (value.length === 0) {
      return [];
    }
    return [
      createTableComponent({
        id: key,
        array: value,
      }),
    ];
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
    components.push(
      createListComponent({
        id: key,
        obj: simpleProps,
      }),
    );
  }

  // Process complex properties
  const complexComponents = processComplexProperties(key, complexProps);
  components.push(...complexComponents);

  return components;
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
