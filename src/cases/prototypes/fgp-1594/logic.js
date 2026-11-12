/* eslint-disable complexity -- Keep the throwaway experiment direct, without production abstractions. */
/* THROWAWAY FGP-1594. Portable logic shared by the offline demo and Mongo probe.
 * Deliberately separate from production models, routes and expression resolution.
 */
const read = (object, path) =>
  path.split(".").reduce((value, key) => value?.[key], object);
const fail = (message) => {
  throw new Error(message);
};
const paths = /(?:\$case\.|\$group\.|@\.)[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)*/g;
const casePaths = [
  "caseRef",
  "workflowCode",
  "currentPhase",
  "currentStage",
  "currentStatus",
  "createdAt",
  "payload.identifiers.sbi",
  "payload.answers.applicant.business.name",
];
const keyName = (entry) => entry.name ?? entry.value.split(".").at(-1);
export const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
};
export const keyHash = async (config, key) => {
  const bytes = new TextEncoder().encode(
    JSON.stringify([config.caseType, config.pageKey, canonical(key)]),
  );
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
};
export const labelFor = (kase, config) =>
  kase.labels?.find((label) => label.namespace === config.labels.namespace) ??
  null;
export const functions = {
  count: (cases) => cases.length,
  labelCount: (cases, code, config) =>
    cases.filter((kase) => labelFor(kase, config)?.code === code).length,
  unlabelledCount: (cases, config) =>
    cases.filter((kase) => !labelFor(kase, config)).length,
  first: (cases, path) => read(cases[0], path.replace("$case.", "")),
  groupStatus: (cases, config) => {
    const count = functions.unlabelledCount(cases, config);
    return count === cases.length
      ? "NOT_STARTED"
      : count === 0
        ? "COMPLETED"
        : "IN_PROGRESS";
  },
};
const arity = {
  count: 1,
  labelCount: 2,
  unlabelledCount: 1,
  first: 2,
  groupStatus: 1,
};
const parseFunction = (value) => {
  const match = /^function:(\w+)\((.*)\)$/.exec(value);
  if (!match || !Object.hasOwn(arity, match[1]))
    fail(`Unknown function: ${value}`);
  const args = match[2].split(",").map((arg) => arg.trim());
  if (args.length !== arity[match[1]])
    fail(`Wrong function arguments: ${value}`);
  return { name: match[1], args };
};
const resolve = (path, context) => {
  const prefix = path.startsWith("@.") ? "@" : path.split(".")[0];
  return read(context[prefix], path.slice(prefix.length + 1));
};
const evaluate = (value, context, config) => {
  if (Array.isArray(value))
    return value.map((item) => evaluate(item, context, config));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        evaluate(item, context, config),
      ]),
    );
  if (typeof value !== "string") return value;
  if (value.startsWith("function:")) {
    const { name, args } = parseFunction(value);
    return functions[name](
      ...args.map((arg) =>
        arg.startsWith("'") ? arg.slice(1, -1) : resolve(arg, context),
      ),
      config,
    );
  }
  if (/^(?:\$case\.|\$group\.|@\.)[\w.]+$/.test(value))
    return resolve(value, context) ?? null;
  return value.replace(paths, (path) => String(resolve(path, context) ?? ""));
};
const validateExpressions = (node, allowed) => {
  if (typeof node === "object" && node !== null)
    return Object.values(node).forEach((value) =>
      validateExpressions(value, allowed),
    );
  if (typeof node !== "string") return;
  for (const path of node.match(paths) ?? [])
    if (!allowed.has(path)) fail(`Unknown path: ${path}`);
  if (node.startsWith("function:")) {
    const { name, args } = parseFunction(node);
    if (!/^@\.(cases|activeCases|excludedCases)$/.test(args[0]))
      fail(`Expected a case collection: ${node}`);
    if (args[1] && !/^'[^']*'$/.test(args[1]))
      fail(`Expected a quoted argument: ${node}`);
    if (
      name === "first" &&
      !casePaths.includes(args[1].slice(1, -1).replace("$case.", ""))
    )
      fail(`Unknown case path: ${node}`);
  }
};
export const compileConfig = (input) => {
  const config = structuredClone(input);
  if (
    !config.caseType ||
    !config.pageKey ||
    !config.scope?.phase ||
    !config.scope.stage ||
    !Array.isArray(config.scope.excludeStatuses)
  )
    fail("Missing page identity or scope");
  if (
    !config.groupBy?.length ||
    new Set(config.groupBy.map(keyName)).size !== config.groupBy.length
  )
    fail("Group key names must be unique");
  for (const entry of config.groupBy) {
    if (
      !casePaths.includes(entry.value?.replace("$case.", "")) ||
      !entry.value.startsWith("$case.")
    )
      fail(`Unsupported group path: ${entry.value}`);
    if (entry.match || entry.normalise)
      fail("Only exact matching is supported by this spike");
    if (["__proto__", "constructor", "prototype"].includes(keyName(entry)))
      fail("Invalid group key name");
  }
  if (!config.labels?.namespace || !config.labels.options?.length)
    fail("Missing label configuration");
  const codes = config.labels.options.map((option) => option.code);
  if (
    codes.some((code) => !/^[A-Z_]+$/.test(code)) ||
    new Set(codes).size !== codes.length
  )
    fail("Invalid label codes");
  for (const option of config.labels.options) {
    for (const [name, rule] of Object.entries(option.data ?? {}))
      if (
        name !== "duplicateOf" ||
        rule.required !== true ||
        rule.oneOf !== "activeGroupCases"
      )
        fail("Unsupported label data rule");
    validateExpressions(option.text, new Set(["@.data.duplicateOf"]));
  }
  const allowed = new Set([
    ...casePaths.map((path) => `$case.${path}`),
    "$group.assignee.name",
    "@.cases",
    "@.activeCases",
    "@.excludedCases",
    ...config.groupBy.map((entry) => `@.key.${keyName(entry)}`),
  ]);
  validateExpressions(config.data, allowed);
  const rowPaths = new Set(["@.caseType", "@.keyHash"]);
  for (const [column, fields] of Object.entries(config.data)) {
    for (const field of Object.keys(fields))
      rowPaths.add(`@.${column}.${field}`);
    validateExpressions(
      config.columns[column],
      new Set([
        ...rowPaths,
        ...Object.keys(fields).map((field) => `@.${field}`),
      ]),
    );
  }
  for (const sort of config.sort ?? []) {
    if (
      !rowPaths.has(sort.value) ||
      !["ascending", "descending"].includes(sort.order)
    )
      fail("Unsupported sort");
  }
  return config;
};
const validKey = (value) =>
  ["string", "number"].includes(typeof value) &&
  value !== "" &&
  (typeof value !== "number" || Number.isFinite(value));
export const groupCases = (cases, config) => {
  const groups = new Map();
  for (const kase of cases) {
    if (
      kase.workflowCode !== config.caseType ||
      kase.currentPhase !== config.scope.phase ||
      kase.currentStage !== config.scope.stage
    )
      continue;
    const key = Object.fromEntries(
      config.groupBy.map((entry) => [
        keyName(entry),
        read(kase, entry.value.replace("$case.", "")),
      ]),
    );
    if (!Object.values(key).every(validKey)) continue; // Never group unrelated missing SBIs.
    const id = canonical(key);
    if (!groups.has(id)) groups.set(id, { key, cases: [] });
    groups.get(id).cases.push(kase);
  }
  return [...groups.values()];
};
export const buildRows = async (
  groups,
  aggregates,
  config,
  visibleOnly = true,
) => {
  const rows = await Promise.all(
    groups.map(async (group) => {
      const cases = [...group.cases].sort(
        (a, b) =>
          new Date(a.createdAt) - new Date(b.createdAt) ||
          a.caseRef.localeCompare(b.caseRef),
      );
      const activeCases = cases.filter(
        (kase) => !config.scope.excludeStatuses.includes(kase.currentStatus),
      );
      const excludedCases = cases.filter((kase) =>
        config.scope.excludeStatuses.includes(kase.currentStatus),
      );
      const hash = await keyHash(config, group.key);
      const aggregate = aggregates.find(
        (item) =>
          item.caseType === config.caseType &&
          item.pageKey === config.pageKey &&
          item.keyHash === hash,
      );
      const row = {
        ...group,
        caseType: config.caseType,
        keyHash: hash,
        cases,
        activeCases,
        excludedCases,
      };
      const data = evaluate(
        config.data,
        { "@": row, $group: aggregate },
        config,
      );
      const columns = Object.fromEntries(
        Object.entries(config.columns).map(([name, column]) => [
          name,
          evaluate(column, { "@": { ...row, ...data[name] } }, config),
        ]),
      );
      return { ...row, ...data, columns, owner: aggregate?.assignee ?? null };
    }),
  );
  const visible = rows.filter(
    (row) => !visibleOnly || row.activeCases.length >= 2,
  );
  return visible.sort((a, b) => {
    for (const sort of config.sort ?? []) {
      const left = resolve(sort.value, { "@": a });
      const right = resolve(sort.value, { "@": b });
      const order = left < right ? -1 : left > right ? 1 : 0;
      if (order) return order * (sort.order === "descending" ? -1 : 1);
    }
    return a.keyHash.localeCompare(b.keyHash);
  });
};
export const labelOptions = (row, kase, config) => [
  { value: "", text: "Not set", label: null },
  ...config.labels.options.flatMap((option) => {
    const choices = option.data
      ? row.activeCases
          .filter((other) => other.caseRef !== kase.caseRef)
          .map((other) => ({ duplicateOf: other.caseRef }))
      : [undefined];
    return choices.map((data) => ({
      value: JSON.stringify({ code: option.code, ...(data && { data }) }),
      text: evaluate(option.text, { "@": { data } }, config),
      label: { code: option.code, ...(data && { data }) },
    }));
  }),
];
const labelValue = (label) =>
  label ? { code: label.code, data: label.data ?? {} } : null;
// Validate the entire submission BEFORE making a write. New arrivals may be omitted.
export const planSave = (
  row,
  command,
  users,
  config,
  actor,
  now = new Date().toISOString(),
) => {
  if (
    !Object.hasOwn(command, "assignee") ||
    !command.labels ||
    typeof command.labels !== "object" ||
    Array.isArray(command.labels)
  )
    fail("Owner and labels must be submitted together");
  const owner =
    command.assignee === null
      ? null
      : users.find((user) => user.id === command.assignee);
  if (command.assignee !== null && !owner)
    fail("Assignee is not in the assignment list");
  const changes = [];
  for (const [caseRef, label] of Object.entries(command.labels)) {
    const kase = row.cases.find((item) => item.caseRef === caseRef);
    if (!kase || !row.activeCases.some((item) => item.caseRef === caseRef))
      fail("Labels require an active case in this group");
    const oldLabel = labelFor(kase, config);
    // Existing historical targets remain valid when another case is excluded.
    if (
      canonical(labelValue(oldLabel) ?? {}) ===
      canonical(labelValue(label) ?? {})
    )
      continue;
    if (label !== null) {
      const option = config.labels.options.find(
        (item) => item.code === label?.code,
      );
      if (!option) fail("Unknown label code");
      const data = label.data ?? {};
      if (
        Object.keys(data).some((key) => !Object.hasOwn(option.data ?? {}, key))
      )
        fail("Unexpected label data");
      if (
        option.data &&
        !row.activeCases.some(
          (other) =>
            other.caseRef === data.duplicateOf && other.caseRef !== caseRef,
        )
      )
        fail("Duplicate target must be another active case in this group");
    }
    const nextLabel =
      label === null
        ? null
        : {
            ...labelValue(label),
            namespace: config.labels.namespace,
            setBy: actor,
            setAt: now,
            version: (oldLabel?.version ?? 0) + 1,
          };
    changes.push({
      kase,
      nextLabel,
      event: {
        eventType: "CASE_LABEL_CHANGED",
        createdAt: now,
        createdBy: actor,
        description: "Dedupe label changed",
        data: {
          namespace: config.labels.namespace,
          oldLabel,
          newLabel: nextLabel,
        },
      },
    });
  }
  return {
    changes,
    owner,
    ownerChanged: (row.owner?.id ?? null) !== (owner?.id ?? null),
    now,
  };
};
export const applyMemorySave = (
  state,
  row,
  command,
  config,
  users,
  actor = "spike-user",
) => {
  const next = structuredClone(state);
  const plan = planSave(row, command, users, config, actor);
  for (const { kase, nextLabel, event } of plan.changes) {
    const target = next.cases.find(
      (item) =>
        item.workflowCode === config.caseType && item.caseRef === kase.caseRef,
    );
    target.labels = (target.labels ?? []).filter(
      (label) => label.namespace !== config.labels.namespace,
    );
    if (nextLabel) target.labels.push(nextLabel);
    target.timeline.unshift(event);
  }
  if (plan.ownerChanged) {
    let aggregate = next.aggregates.find(
      (item) => item.keyHash === row.keyHash,
    );
    if (!aggregate) {
      aggregate = {
        caseType: config.caseType,
        pageKey: config.pageKey,
        key: row.key,
        keyHash: row.keyHash,
        createdAt: plan.now,
      };
      next.aggregates.push(aggregate);
    }
    Object.assign(aggregate, {
      assignee: plan.owner,
      updatedAt: plan.now,
      version: (aggregate.version ?? 0) + 1,
    });
  }
  return next;
};
