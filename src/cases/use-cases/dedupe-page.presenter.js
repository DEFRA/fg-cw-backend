import { DedupeError, labelFor } from "../models/dedupe-label.js";
import { keyName } from "../models/dedupe-group-key.js";

export const summaryHref = ({ caseType, pageKey }) =>
  `/types/${caseType}/pages/${pageKey}`;
const groupHref = (command, group) =>
  `${summaryHref(command)}/groups/${group.key.routeKey}`;
const choiceValue = (label) =>
  label
    ? label.code === "DUPLICATE"
      ? `DUPLICATE:${label.data.duplicateOf}`
      : "NOT_DUPLICATE"
    : "";
const choiceText = (label) =>
  label
    ? label.code === "DUPLICATE"
      ? `Duplicate with ${label.data.duplicateOf}`
      : "Not duplicate"
    : "Not set";

// Decode BFF form values here, never in the frontend or in the domain model.
// eslint-disable-next-line complexity
export const decodeDedupeForm = (form) => {
  const labels = {};
  for (const [name, value] of Object.entries(form)) {
    if (!name.startsWith("label-")) continue;
    const ref = name.slice(6);
    if (value === "") labels[ref] = null;
    else if (value === "NOT_DUPLICATE") labels[ref] = { code: "NOT_DUPLICATE" };
    else if (/^DUPLICATE:[\w-]+$/.test(value))
      labels[ref] = {
        code: "DUPLICATE",
        data: { duplicateOf: value.slice(10) },
      };
    else throw new DedupeError("Choose a valid case label", ref);
  }
  return { assignee: form.assignee || null, labels };
};
const heading = (group, config) =>
  config.groupBy
    .map(
      (entry) =>
        `${entry.label ?? keyName(entry)} ${group.key.values[keyName(entry)]}`,
    )
    .join(" · ");
const statusDisplay = {
  NOT_STARTED: { text: "Not started", classes: "govuk-tag--blue" },
  IN_PROGRESS: { text: "In progress", classes: "govuk-tag--light-blue" },
  COMPLETED: { text: "Completed", classes: "govuk-tag--green" },
};
export const presentSummary = (command, title, rows, config) => {
  const completed = rows.filter(
    ({ group }) => group.status === "COMPLETED",
  ).length;
  return {
    pageType: "dedupe",
    title,
    completed,
    total: rows.length,
    heading: `${completed} of ${rows.length} issues completed`,
    backLink: { href: "/cases", text: "All cases" },
    caption: "Issues with two or more active applications",
    emptyText: "No issues to review.",
    // eslint-disable-next-line complexity -- Declarative summary presentation with optional values.
    rows: rows.map(({ group, assignment }) => ({
      keyHash: group.key.hash,
      href: groupHref(command, group),
      details: { ...group.key.values },
      assignee: { name: assignment.assignee?.name ?? "Not set" },
      status: statusDisplay[group.status],
      columns: {
        details: [
          {
            component: "url",
            text: `${heading(group, config)}: ${group.cases[0]?.businessName ?? ""}`,
            href: groupHref(command, group),
          },
          {
            component: "hint",
            text: `${group.counts.total} applications: ${group.counts.notSet} Not set, ${group.counts.notDuplicate} Not duplicate, ${group.counts.duplicate} Duplicate; ${group.counts.excluded} excluded`,
          },
        ],
      },
    })),
  };
};
const selectItems = (items, stored, submitted) => {
  const value =
    submitted !== undefined && items.some((item) => item.value === submitted)
      ? submitted
      : stored;
  return items.map((item) => ({ ...item, selected: item.value === value }));
};
// eslint-disable-next-line complexity -- Keep historical and editable select presentation together.
const labelField = (group, kase, canEdit, submitted) => {
  const current = labelFor(kase);
  const stored = choiceValue(current);
  const items = [
    { value: "", text: "Not set" },
    { value: "NOT_DUPLICATE", text: "Not duplicate" },
    ...group.duplicateTargets(kase.caseRef).map((target) => ({
      value: `DUPLICATE:${target.caseRef}`,
      text: `Duplicate with ${target.caseRef}`,
    })),
  ];
  if (stored && !items.some((item) => item.value === stored))
    items.push({
      value: stored,
      text: `${choiceText(current)} (historical target)`,
    });
  const disabled = !canEdit || group.isExcluded(kase);
  const name = `label-${kase.caseRef}`;
  return {
    id: name,
    name,
    label: {
      text: `Label for case ${kase.caseRef}`,
      classes: "govuk-visually-hidden",
    },
    items: selectItems(items, stored, disabled ? undefined : submitted),
    disabled,
  };
};
export const presentGroup = ({
  command,
  group,
  assignment,
  config,
  users,
  canEdit,
  form = {},
  error,
  // eslint-disable-next-line complexity -- Declarative BFF fields and optional error presentation.
}) => ({
  pageType: "dedupe",
  title: heading(group, config),
  heading: heading(group, config),
  intro: `${group.cases[0]?.businessName ?? ""} · ${group.counts.total} applications`,
  backLink: { href: summaryHref(command), text: "Back to issues" },
  form: { id: "dedupe-review", action: groupHref(command, group) },
  ownerField: {
    id: "assignee",
    name: "assignee",
    label: { text: "Issue owner" },
    disabled: !canEdit,
    items: selectItems(
      [
        { value: "", text: "Not set" },
        ...users.map((user) => ({ value: user.id, text: user.name })),
      ],
      assignment.assignee?.id ?? "",
      form.assignee,
    ),
  },
  rows: group.cases.map((kase) => ({
    caseLink: { href: `/cases/${kase._id.toHexString()}`, text: kase.caseRef },
    note: group.isExcluded(kase) ? `Excluded: ${kase.currentStatus}` : null,
    labelField: labelField(group, kase, canEdit, form[`label-${kase.caseRef}`]),
  })),
  saveButton: canEdit ? { text: "Save and continue" } : null,
  errorList: error
    ? [
        {
          text: error.message,
          href: error.caseRef ? `#label-${error.caseRef}` : "#assignee",
        },
      ]
    : [],
});
export const presentDedupeTimeline = (event) =>
  `${choiceText(event.data.oldLabel)} → ${choiceText(event.data.newLabel)}`;
