import Boom from "@hapi/boom";
import { keyName } from "../models/dedupe-group-key.js";
import {
  caseDataPath,
  dedupeConfigurationSchema,
} from "./dedupe-page.schema.js";

const reference = /(?:@|\$group)\.[A-Za-z]\w*(?:\.[A-Za-z_]\w*)*/g;
const collections = new Set(["cases", "activeCases", "excludedCases"]);
const arities = {
  first: 2,
  count: 1,
  labelCount: 2,
  unlabelledCount: 1,
  groupStatus: 1,
};
const reserved = new Set([
  "constructor",
  "prototype",
  "__proto__",
  "groupHref",
]);
const invalid = (location, message) => {
  throw Boom.badRequest(
    `Invalid dedupe configuration at ${location}: ${message}`,
  );
};
const checkedReference = (value, allowed, location) => {
  if (!allowed.has(value)) invalid(location, `Unknown reference ${value}`);
  return { kind: "reference", value };
};
const sourceSlot = (path, sourcePaths, location) => {
  const checked = caseDataPath.validate(path);
  if (checked.error) invalid(location, `Invalid source path ${path}`);
  let entry = sourcePaths.find((item) => item.path === path.slice(6));
  if (!entry) {
    entry = { path: path.slice(6), slot: `s${sourcePaths.length}` };
    sourcePaths.push(entry);
  }
  return entry.slot;
};
// A deliberately bounded grammar: no nesting, filters or executable expressions.
// eslint-disable-next-line complexity
const compileFunction = (value, sourcePaths, location) => {
  const match = /^function:(\w+)\(\s*@\.(\w+)\s*(?:,\s*'([^']*)'\s*)?\)$/.exec(
    value,
  );
  if (!match || !Object.hasOwn(arities, match[1]))
    invalid(location, "Unknown or malformed function");
  const [, name, collection, argument] = match;
  if (!collections.has(collection))
    invalid(location, "Function needs a declared case collection");
  if ((argument === undefined ? 1 : 2) !== arities[name])
    invalid(location, "Invalid function arity");
  if (name === "groupStatus" && collection !== "activeCases")
    invalid(location, "groupStatus requires activeCases");
  if (
    name === "labelCount" &&
    !["NOT_DUPLICATE", "DUPLICATE"].includes(argument)
  )
    invalid(location, "Unknown fixed label code");
  return {
    kind: "call",
    name,
    collection,
    argument,
    ...(name === "first" && {
      slot: sourceSlot(argument, sourcePaths, location),
    }),
  };
};
const compileValue = (
  value,
  allowed,
  sourcePaths,
  location,
  functions = false,
  // eslint-disable-next-line complexity -- Parse only the bounded presentation grammar.
) => {
  if (typeof value !== "string") return { kind: "literal", value };
  if (value.startsWith("function:")) {
    if (!functions) invalid(location, "Functions are only supported in data");
    return compileFunction(value, sourcePaths, location);
  }
  const matches = [...value.matchAll(reference)];
  if (matches.length === 1 && matches[0][0] === value)
    return checkedReference(value, allowed, location);
  const parts = [];
  let offset = 0;
  for (const match of matches) {
    parts.push({ kind: "literal", value: value.slice(offset, match.index) });
    parts.push(checkedReference(match[0], allowed, location));
    offset = match.index + match[0].length;
  }
  const remainder = value.replace(reference, "");
  if (/(?:@\.|\$group\.|\$case\.|jsonata:)/.test(remainder))
    invalid(location, "Unsupported expression");
  parts.push({ kind: "literal", value: value.slice(offset) });
  return { kind: "template", parts };
};
const compileData = (data, allowed, sourcePaths) =>
  Object.fromEntries(
    Object.entries(data).map(([column, fields]) => [
      column,
      Object.fromEntries(
        Object.entries(fields).map(([field, value]) => {
          if (reserved.has(field))
            invalid(`data.${column}.${field}`, "Reserved field name");
          return [
            field,
            compileValue(
              value,
              allowed,
              sourcePaths,
              `data.${column}.${field}`,
              true,
            ),
          ];
        }),
      ),
    ]),
  );
const compileMap = (value, location) => {
  if (
    Object.values(value).some((text) =>
      /(?:@\.|\$group\.|\$case\.|function:|jsonata:)/.test(text),
    )
  )
    invalid(location, "Status maps require literal display values");
  return { kind: "literal", value };
};
const compileColumns = (columns, data, sourcePaths) =>
  Object.fromEntries(
    Object.entries(columns).map(([column, components]) => {
      const allowed = new Set([
        "@.groupHref",
        ...Object.keys(data[column]).map((name) => `@.${name}`),
      ]);
      return [
        column,
        components.map((component, index) =>
          Object.fromEntries(
            Object.entries(component).map(([name, value]) => [
              name,
              typeof value === "object"
                ? compileMap(value, `columns.${column}[${index}].${name}`)
                : compileValue(
                    value,
                    allowed,
                    sourcePaths,
                    `columns.${column}[${index}].${name}`,
                  ),
            ]),
          ),
        ),
      ];
    }),
  );
export const compileDedupe = (configuration) => {
  const { value: config, error } =
    dedupeConfigurationSchema.validate(configuration);
  if (error) invalid(error.details[0].path.join("."), error.message);
  const names = config.groupBy.map(keyName);
  if (new Set(names).size !== names.length)
    invalid("groupBy", "Group key names must be unique");
  const sourcePaths = [];
  const allowed = new Set([
    "$group.assignee.name",
    ...names.map((name) => `@.key.${name}`),
  ]);
  const data = compileData(config.data, allowed, sourcePaths);
  const columns = compileColumns(config.columns, config.data, sourcePaths);
  const sorts = new Set(
    Object.entries(config.data).flatMap(([column, fields]) =>
      Object.keys(fields).map((field) => `@.${column}.${field}`),
    ),
  );
  config.sort.forEach((sort, index) => {
    if (!sorts.has(sort.value))
      invalid(`sort[${index}].value`, "Unknown sort field");
  });
  return { ...config, plan: { data, columns, sourcePaths, sort: config.sort } };
};
