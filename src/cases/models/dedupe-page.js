import Boom from "@hapi/boom";
import { createHash } from "node:crypto";
import { dedupeConfigurationSchema } from "../schemas/dedupe-page.schema.js";

export const keyName = (entry) => entry.name ?? entry.value.split(".").at(-1);
export const readPath = (object, path) =>
  path.split(".").reduce((value, key) => value?.[key], object);
export const canonical = (value) =>
  JSON.stringify(value, Object.keys(value).sort());
export const groupHash = (caseType, pageKey, key) =>
  createHash("sha256")
    .update(JSON.stringify([caseType, pageKey, canonical(key)]))
    .digest("hex");
export const labelFor = (kase, namespace) =>
  kase.labels?.find((label) => label.namespace === namespace) ?? null;
export const unlabelledCount = (cases, namespace) =>
  cases.filter((kase) => !labelFor(kase, namespace)).length;
export const groupStatus = (cases, namespace) => {
  const remaining = unlabelledCount(cases, namespace);
  if (remaining === cases.length) return "NOT_STARTED";
  return remaining === 0 ? "COMPLETED" : "IN_PROGRESS";
};
export const dedupeFunctions = {
  count: (cases) => cases.length,
  unlabelledCount,
  labelCount: (cases, code, namespace) =>
    cases.filter((kase) => labelFor(kase, namespace)?.code === code).length,
  first: (cases, path) => readPath(cases[0], path.replace("$case.", "")),
  groupStatus,
};
const arity = {
  count: 1,
  unlabelledCount: 1,
  labelCount: 2,
  first: 2,
  groupStatus: 1,
};
const referencePattern =
  /(?:\$case\.|\$group\.|@\.)[A-Za-z][\w]*(?:\.[A-Za-z][\w]*)*/g;
const parseFunction = (expression) => {
  const parsed = /^function:(\w+)\((.*)\)$/.exec(expression);
  if (!parsed || !Object.hasOwn(arity, parsed[1]))
    throw Boom.badRequest(`Unknown dedupe function: ${expression}`);
  const args = parsed[2].split(",").map((item) => item.trim());
  if (args.length !== arity[parsed[1]])
    throw Boom.badRequest(`Invalid function arguments: ${expression}`);
  return { name: parsed[1], args };
};
const resolve = (path, context) => {
  const [root, ...parts] = path.split(".");
  return readPath(context[root], parts.join("."));
};
// The spike grammar intentionally has no nested functions or arbitrary code.
// eslint-disable-next-line complexity
export const evaluateDedupe = (expression, context, namespace) => {
  if (Array.isArray(expression))
    return expression.map((value) => evaluateDedupe(value, context, namespace));
  if (expression && typeof expression === "object")
    return Object.fromEntries(
      Object.entries(expression).map(([key, value]) => [
        key,
        evaluateDedupe(value, context, namespace),
      ]),
    );
  if (typeof expression !== "string") return expression;
  if (expression.startsWith("function:")) {
    const { name, args } = parseFunction(expression);
    return dedupeFunctions[name](
      ...args.map((arg) =>
        arg.startsWith("'") ? arg.slice(1, -1) : resolve(arg, context),
      ),
      namespace,
    );
  }
  if (/^(?:\$case\.|\$group\.|@\.)[\w.]+$/.test(expression))
    return resolve(expression, context) ?? null;
  return expression.replace(referencePattern, (path) =>
    String(resolve(path, context) ?? ""),
  );
};
const checkPath = (path, allowed) => {
  if (path.startsWith("$case.payload.")) return; // Payload shape is grant-specific.
  if (!allowed.has(path)) throw Boom.badRequest(`Unknown dedupe path: ${path}`);
};
// eslint-disable-next-line complexity
const checkExpressions = (value, allowed) => {
  if (value && typeof value === "object")
    return Object.values(value).forEach((item) =>
      checkExpressions(item, allowed),
    );
  if (typeof value !== "string") return;
  for (const path of value.match(referencePattern) ?? [])
    checkPath(path, allowed);
  if (!value.startsWith("function:")) return;
  const { args } = parseFunction(value);
  if (!/^@\.(cases|activeCases|excludedCases)$/.test(args[0]))
    throw Boom.badRequest("Dedupe function needs a case collection");
  if (args[1] && !/^'[^']*'$/.test(args[1]))
    throw Boom.badRequest("Dedupe function needs a quoted argument");
};
// eslint-disable-next-line complexity
export const compileDedupe = (configuration) => {
  const { value: config, error } =
    dedupeConfigurationSchema.validate(configuration);
  if (error)
    throw Boom.badRequest(`Invalid dedupe configuration: ${error.message}`);
  const names = config.groupBy.map(keyName);
  if (new Set(names).size !== names.length)
    throw Boom.badRequest("Group key names must be unique");
  const unsafe = /(^|\.)(__proto__|constructor|prototype)(\.|$)/;
  if (
    config.groupBy.some(
      (entry) => unsafe.test(entry.value) || unsafe.test(keyName(entry)),
    )
  )
    throw Boom.badRequest("Invalid group path");
  const allowed = new Set([
    "@.cases",
    "@.activeCases",
    "@.excludedCases",
    "$case.caseRef",
    "$group.assignee.name",
    ...names.map((name) => `@.key.${name}`),
  ]);
  checkExpressions(config.data, allowed);
  for (const [column, fields] of Object.entries(config.data)) {
    checkExpressions(
      config.columns[column],
      new Set([
        "@.caseType",
        "@.pageKey",
        "@.keyHash",
        ...Object.keys(fields).map((field) => `@.${field}`),
      ]),
    );
  }
  const sorts = new Set(
    Object.entries(config.data).flatMap(([column, fields]) =>
      Object.keys(fields).map((field) => `@.${column}.${field}`),
    ),
  );
  if (config.sort.some((sort) => !sorts.has(sort.value)))
    throw Boom.badRequest("Unknown dedupe sort path");
  for (const option of config.labels.options)
    checkExpressions(option.text, new Set(["@.data.duplicateOf"]));
  return config;
};
export const buildGroupRow = (group, owner, config, caseType, pageKey) => {
  const cases = group.cases;
  const activeCases = cases.filter(
    (kase) => !config.scope.excludeStatuses.includes(kase.currentStatus),
  );
  const excludedCases = cases.filter((kase) =>
    config.scope.excludeStatuses.includes(kase.currentStatus),
  );
  const row = {
    ...group,
    caseType,
    pageKey,
    keyHash: groupHash(caseType, pageKey, group.key),
    activeCases,
    excludedCases,
  };
  const data = evaluateDedupe(
    config.data,
    { "@": row, $group: { assignee: owner } },
    config.labels.namespace,
  );
  const columns = Object.fromEntries(
    Object.entries(config.columns).map(([name, components]) => [
      name,
      evaluateDedupe(
        components,
        { "@": { ...row, ...data[name] } },
        config.labels.namespace,
      ),
    ]),
  );
  const statusDisplay = {
    NOT_STARTED: { text: "Not started", classes: "govuk-tag--blue" },
    IN_PROGRESS: { text: "In progress", classes: "govuk-tag--light-blue" },
    COMPLETED: { text: "Completed", classes: "govuk-tag--green" },
  };
  return {
    ...row,
    ...data,
    status: { ...data.status, ...statusDisplay[data.status.tag] },
    columns,
    owner,
  };
};
export const sortGroupRows = (rows, config) =>
  // eslint-disable-next-line complexity
  rows.sort((a, b) => {
    for (const sort of config.sort) {
      const left = readPath(a, sort.value.slice(2));
      const right = readPath(b, sort.value.slice(2));
      if (left !== right)
        return (left < right ? -1 : 1) * (sort.order === "descending" ? -1 : 1);
    }
    return a.keyHash.localeCompare(b.keyHash);
  });
export const caseLabelOptions = (row, kase, config) => [
  { value: "", text: "Not set" },
  ...config.labels.options.flatMap((option) => {
    const choices = option.data
      ? row.activeCases
          .filter((other) => other.caseRef !== kase.caseRef)
          .map((other) => ({ duplicateOf: other.caseRef }))
      : [null];
    return choices.map((data) => ({
      value: JSON.stringify({ code: option.code, data }),
      text: evaluateDedupe(
        option.text,
        { "@": { data } },
        config.labels.namespace,
      ),
    }));
  }),
];
// Validate before any writes, including the unchanged historical-reference rule.
// eslint-disable-next-line complexity
export const validateLabels = (row, labels, config) => {
  for (const [caseRef, label] of Object.entries(labels)) {
    const kase = row.activeCases.find((item) => item.caseRef === caseRef);
    if (!kase)
      throw Boom.badRequest(
        "Labels must belong to an active case in this group",
      );
    const old = labelFor(kase, config.labels.namespace);
    if (sameLabel(old, label)) continue;
    if (label === null) continue;
    const option = config.labels.options.find(
      (item) => item.code === label.code,
    );
    if (!option) throw Boom.badRequest("Unknown label code");
    const data = label.data ?? {};
    if (
      Object.keys(data).some((name) => !Object.hasOwn(option.data ?? {}, name))
    )
      throw Boom.badRequest("Unexpected label data");
    if (
      option.data &&
      !row.activeCases.some(
        (other) =>
          other.caseRef === data.duplicateOf && other.caseRef !== caseRef,
      )
    )
      throw Boom.badRequest(
        "Duplicate target must be another active case in this group",
      );
  }
};
// eslint-disable-next-line complexity
export const sameLabel = (a, b) =>
  JSON.stringify([a?.code ?? null, a?.data?.duplicateOf ?? null]) ===
  JSON.stringify([b?.code ?? null, b?.data?.duplicateOf ?? null]);
