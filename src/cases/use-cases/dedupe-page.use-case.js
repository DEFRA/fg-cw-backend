import Boom from "@hapi/boom";
import { AccessControl } from "../../common/access-control.js";
import {
  auditActions,
  auditEntities,
  buildAuditSecurity,
} from "../../common/audit-constants.js";
import { buildSecurityContext } from "../../common/audit-security-context.js";
import { createPageResponse } from "../../common/create-page-response.js";
import { withAudit } from "../../common/with-audit.js";
import { withTransaction } from "../../common/with-transaction.js";
import { IdpRoles } from "../../users/models/idp-roles.js";
import { findAssigneesUseCase } from "../../users/use-cases/find-assignees.use-case.js";
import {
  buildGroupRow,
  caseLabelOptions,
  compileDedupe,
  groupHash,
  labelFor,
  sameLabel,
  sortGroupRows,
  validateLabels,
} from "../models/dedupe-page.js";
import { findByCaseRefAndWorkflowCode } from "../repositories/case.repository.js";
import { findCurrent } from "../repositories/config-version.repository.js";
import {
  findDedupeGroups,
  findGroupOwners,
  saveCaseLabel,
  saveGroupOwner,
} from "../repositories/dedupe.repository.js";
import { findByCodeAndVersion } from "../repositories/workflow.repository.js";
import { createRoleFilter } from "./find-cases.use-case.js";
import { findWorkflowCodesUseCase } from "./find-workflow-codes.use-case.js";
import { resolveAndFetchWorkflowUseCase } from "./resolve-and-fetch-workflow.use-case.js";

const loadListWorkflow = async (caseType) => {
  const current = await findCurrent(caseType);
  if (!current) throw Boom.notFound("No active workflow for this case type");
  const stored = await findByCodeAndVersion(caseType, current.version);
  if (stored) return stored;
  return (await resolveAndFetchWorkflowUseCase(caseType, current.version))
    .workflow;
};
const authorise = (user, workflow, write) =>
  AccessControl.authorise(user, {
    idpRoles: write
      ? [IdpRoles.ReadWrite]
      : [IdpRoles.Read, IdpRoles.ReadWrite],
    appRoles: workflow.requiredRoles,
  });
// eslint-disable-next-line complexity
const loadPage = async ({ caseType, pageKey, user }, write = false) => {
  const workflow = await loadListWorkflow(caseType);
  authorise(user, workflow, write);
  workflow.validateCaseListPages();
  const tab = workflow.pages?.["case-list"]?.tabs?.[pageKey];
  if (!tab) throw Boom.notFound("Case list page not found");
  return {
    workflow,
    title: tab.title,
    config: compileDedupe(tab["page-type"].configuration),
  };
};
const rowsFor = async (command, config, visibleOnly, session) => {
  const groups = await findDedupeGroups(
    command.caseType,
    config,
    visibleOnly,
    session,
  );
  const owners = await findGroupOwners(
    command.caseType,
    command.pageKey,
    groups,
    session,
  );
  return sortGroupRows(
    groups.map((group) => {
      const owner = owners.find(
        (item) =>
          item.keyHash ===
          groupHash(command.caseType, command.pageKey, group.key),
      );
      return buildGroupRow(
        group,
        owner?.assignee ?? null,
        config,
        command.caseType,
        command.pageKey,
      );
    }),
    config,
  );
};
const groupFor = async (command, config, session) => {
  const row = (await rowsFor(command, config, false, session)).find(
    (item) => item.keyHash === command.keyHash,
  );
  if (!row) throw Boom.notFound("Case group not found");
  return row;
};
const usersFor = (workflow) =>
  findAssigneesUseCase({
    allAppRoles: workflow.requiredRoles.allOf,
    anyAppRoles: workflow.requiredRoles.anyOf,
  });
const auditFor =
  (action) =>
  ([command]) => ({
    entities: [
      {
        entity: auditEntities.CASE,
        action,
        entityid: command.keyHash ?? command.caseType,
      },
    ],
    details: {
      security: buildSecurityContext(command.user),
      caseType: command.caseType,
      pageKey: command.pageKey,
      command: command.payload,
    },
    security: buildAuditSecurity(action),
    segregationRef: `${action}-${command.user.id}`,
  });
// eslint-disable-next-line complexity
const listPages = async ({ user }) => {
  const codes = await findWorkflowCodesUseCase(
    createRoleFilter(user.getRoles()),
  );
  const pages = [];
  for (const caseType of codes) {
    const current = await findCurrent(caseType);
    if (!current) continue;
    const workflow = await loadListWorkflow(caseType);
    authorise(user, workflow, false);
    for (const [pageKey, tab] of Object.entries(
      workflow.pages?.["case-list"]?.tabs ?? {},
    ))
      pages.push({
        caseType,
        pageKey,
        title: tab.title,
        type: tab["page-type"].type,
        href: `/types/${caseType}/pages/${pageKey}`,
      });
  }
  return createPageResponse({ user, data: { pages } });
};
export const listCasePagesUseCase = withAudit(
  listPages,
  auditFor(auditActions.VIEW_CASE_LIST),
);
const summary = async (command) => {
  const { title, config } = await loadPage(command);
  const rows = await rowsFor(command, config, true);
  const completed = rows.filter((row) => row.status.tag === "COMPLETED").length;
  return createPageResponse({
    user: command.user,
    data: {
      pageType: "dedupe",
      title,
      completed,
      total: rows.length,
      heading: `${completed} of ${rows.length} issues completed`,
      rows: rows.map(({ keyHash, details, assignee, status, columns }) => ({
        keyHash,
        details,
        assignee,
        status,
        columns,
      })),
    },
  });
};
export const viewDedupeSummaryUseCase = withAudit(
  summary,
  auditFor(auditActions.VIEW_CASE_LIST),
);
const detail = async (command) => {
  const { config, workflow } = await loadPage(command);
  const row = await groupFor(command, config);
  const cases = row.cases.map((kase) => ({
    id: kase._id.toHexString(),
    caseRef: kase.caseRef,
    excluded: !row.activeCases.includes(kase),
    status: kase.currentStatus,
    label: labelFor(kase, config.labels.namespace),
    options: caseLabelOptions(row, kase, config),
  }));
  return createPageResponse({
    user: command.user,
    data: {
      pageType: "dedupe",
      details: row.details,
      key: row.key,
      owner: row.owner,
      users: await usersFor(workflow),
      canEdit: command.user.hasIdpRole(IdpRoles.ReadWrite),
      cases,
    },
  });
};
export const viewDedupeGroupUseCase = withAudit(
  detail,
  auditFor(auditActions.VIEW_CASE),
);
// eslint-disable-next-line complexity
const save = async (command, session) => {
  const { config, workflow } = await loadPage(command, true);
  const row = await groupFor(command, config, session);
  const assignee =
    command.payload.assignee === null
      ? null
      : (await usersFor(workflow)).find(
          (user) => user.id === command.payload.assignee,
        );
  if (command.payload.assignee !== null && !assignee)
    throw Boom.badRequest("Choose an eligible issue owner");
  validateLabels(row, command.payload.labels, config);
  let changedLabels = 0;
  for (const [caseRef, label] of Object.entries(command.payload.labels)) {
    const kase = await findByCaseRefAndWorkflowCode(
      caseRef,
      command.caseType,
      session,
    );
    if (sameLabel(labelFor(kase, config.labels.namespace), label)) continue;
    const event = kase.setLabel({
      namespace: config.labels.namespace,
      label,
      createdBy: command.user.id,
    });
    await saveCaseLabel(kase, event, session);
    changedLabels++;
  }
  if ((row.owner?.id ?? null) !== (assignee?.id ?? null))
    await saveGroupOwner(
      { ...row, caseType: command.caseType, pageKey: command.pageKey },
      assignee,
      session,
    );
  return { changedLabels };
};
const auditedSave = withAudit(save, auditFor(auditActions.SAVE_CASE_GROUP));
export const saveDedupeGroupUseCase = (command) =>
  withTransaction((session) => auditedSave(command, session));
