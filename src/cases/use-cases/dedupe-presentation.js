import Boom from "@hapi/boom";
import {
  assessmentStatus,
  labelCount,
  unlabelledCount,
} from "../models/dedupe-label.js";

const read = (object, path) =>
  path.split(".").reduce((value, name) => value?.[name], object);
const scalar = (value) => {
  if (value == null) return null;
  if (!["string", "number", "boolean"].includes(typeof value))
    throw Boom.badRequest(
      "Configured dedupe data must resolve to scalar values",
    );
  return value;
};
const functions = {
  count: (cases) => cases.length,
  labelCount: (cases, node) => labelCount(cases, node.argument),
  unlabelledCount,
  groupStatus: assessmentStatus,
  first: (cases, node) => cases[0]?.source?.[node.slot] ?? null,
};
const evaluate = (node, context) => {
  if (node.kind === "literal") return node.value;
  if (node.kind === "reference") return read(context, node.value);
  if (node.kind === "call")
    return functions[node.name](context["@"][node.collection], node);
  return node.parts.map((part) => evaluate(part, context) ?? "").join("");
};
const evaluateFields = (fields, context, scalars = false) =>
  Object.fromEntries(
    Object.entries(fields).map(([name, node]) => [
      name,
      scalars ? scalar(evaluate(node, context)) : evaluate(node, context),
    ]),
  );
export const presentConfiguredData = (group, assignment, plan) => {
  const context = {
    "@": {
      key: group.key.values,
      cases: group.cases,
      activeCases: group.activeCases,
      excludedCases: group.excludedCases,
    },
    $group: { assignee: { name: assignment.assignee?.name ?? "Not set" } },
  };
  return Object.fromEntries(
    Object.entries(plan.data).map(([column, fields]) => [
      column,
      evaluateFields(fields, context, true),
    ]),
  );
};
export const presentConfiguredColumns = (data, href, plan) =>
  Object.fromEntries(
    Object.entries(plan.columns).map(([column, components]) => [
      column,
      components.map((fields) =>
        evaluateFields(fields, { "@": { ...data[column], groupHref: href } }),
      ),
    ]),
  );
const typeRank = { number: 0, string: 1, boolean: 2 };
// Null stays last for either direction; scalar types never coerce into each other.
// eslint-disable-next-line complexity
const compare = (left, right, direction) => {
  if (left === right) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  const rank = typeRank[typeof left] - typeRank[typeof right];
  return (rank || (left < right ? -1 : 1)) * direction;
};
export const sortConfiguredRows = (rows, plan) =>
  rows.sort((left, right) => {
    for (const sort of plan.sort) {
      const path = sort.value.slice(2);
      const order = compare(
        read(left, path),
        read(right, path),
        sort.order === "ascending" ? 1 : -1,
      );
      if (order) return order;
    }
    return left.keyHash.localeCompare(right.keyHash);
  });
