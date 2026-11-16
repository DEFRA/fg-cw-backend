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
import { DedupeGroup } from "../models/dedupe-group.js";
import { DedupeGroupKey, keyName } from "../models/dedupe-group-key.js";
import { DedupeError } from "../models/dedupe-label.js";
import { GroupAssignment } from "../models/group-assignment.js";
import { findByCaseRefAndWorkflowCode } from "../repositories/case.repository.js";
import { findCurrent } from "../repositories/config-version.repository.js";
import {
  findDedupeGroups,
  findDedupeMembers,
  findDedupeReferences,
  findGroupOwners,
  saveCaseLabel,
  saveGroupOwner,
} from "../repositories/dedupe.repository.js";
import { findByCodeAndVersion } from "../repositories/workflow.repository.js";
import {
  decodeDedupeForm,
  presentGroup,
  presentSummary,
  summaryHref,
} from "./dedupe-page.presenter.js";
import { createRoleFilter } from "./find-cases.use-case.js";
import { findWorkflowCodesUseCase } from "./find-workflow-codes.use-case.js";
import { resolveAndFetchWorkflowUseCase } from "./resolve-and-fetch-workflow.use-case.js";

const loadListWorkflow = async (caseType) => {
  const current = await findCurrent(caseType);
  if (!current) throw Boom.notFound("No active workflow for this case type");
  return (
    (await findByCodeAndVersion(caseType, current.version)) ??
    (await resolveAndFetchWorkflowUseCase(caseType, current.version)).workflow
  );
};
const authorise = (user, workflow, write) =>
  AccessControl.authorise(user, {
    idpRoles: write
      ? [IdpRoles.ReadWrite]
      : [IdpRoles.Read, IdpRoles.ReadWrite],
    appRoles: workflow.requiredRoles,
  });
// eslint-disable-next-line complexity -- Check optional workflow page configuration before use.
const loadPage = async ({ caseType, pageKey, user }, write = false) => {
  const workflow = await loadListWorkflow(caseType);
  authorise(user, workflow, write);
  workflow.validateCaseListPages();
  const tab = workflow.pages?.["case-list"]?.tabs?.[pageKey];
  if (!tab) throw Boom.notFound("Case list page not found");
  return {
    workflow,
    title: tab.title,
    config: tab["page-type"].configuration,
  };
};
const usersFor = (workflow) =>
  findAssigneesUseCase({
    allAppRoles: workflow.requiredRoles.allOf,
    anyAppRoles: workflow.requiredRoles.anyOf,
  });
const assignmentFor = (key, owners) =>
  new GroupAssignment(
    key,
    owners.find((owner) => owner.keyHash === key.hash)?.assignee ?? null,
  );
const groupFor = async (command, config, session) => {
  let key;
  try {
    key = DedupeGroupKey.fromRoute(
      command.caseType,
      command.groupKey,
      config.groupBy.map(keyName),
    );
  } catch (error) {
    throw Boom.badRequest(error.message);
  }
  const members = await findDedupeMembers(key, config, session);
  if (!members.length) throw Boom.notFound("Case group not found");
  const owners = await findGroupOwners(
    command.caseType,
    [{ key: key.values }],
    session,
  );
  return {
    group: new DedupeGroup(key, members, config.scope.excludeStatuses),
    assignment: assignmentFor(key, owners),
  };
};
const auditFor =
  (action) =>
  ([command]) => ({
    entities: [
      {
        entity: auditEntities.CASE,
        action,
        entityid: command.groupKey ?? command.caseType,
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
    if (!(await findCurrent(caseType))) continue;
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
        href: summaryHref({ caseType, pageKey }),
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
  const stored = await findDedupeGroups(command.caseType, config, true);
  const owners = await findGroupOwners(command.caseType, stored);
  const rows = stored
    .map((item) => {
      const key = new DedupeGroupKey(command.caseType, item.key);
      return {
        group: new DedupeGroup(key, item.cases, config.scope.excludeStatuses),
        assignment: assignmentFor(key, owners),
      };
    })
    .sort((a, b) => b.group.key.canonical.localeCompare(a.group.key.canonical));
  return createPageResponse({
    user: command.user,
    data: presentSummary(command, title, rows, config),
  });
};
export const viewDedupeSummaryUseCase = withAudit(
  summary,
  auditFor(auditActions.VIEW_CASE_LIST),
);
const detail = async (command, form, error) => {
  const { config, workflow } = await loadPage(command);
  const { group, assignment } = await groupFor(command, config);
  return createPageResponse({
    user: command.user,
    data: presentGroup({
      command,
      group,
      assignment,
      config,
      users: await usersFor(workflow),
      canEdit: command.user.hasIdpRole(IdpRoles.ReadWrite),
      form,
      error,
    }),
  });
};
export const viewDedupeGroupUseCase = withAudit(
  detail,
  auditFor(auditActions.VIEW_CASE),
);
const save = async (command, session) => {
  const { config, workflow } = await loadPage(command, true);
  const { group, assignment } = await groupFor(command, config, session);
  const decoded = decodeDedupeForm(command.payload.form);
  const ownerChanged = assignment.assign(
    decoded.assignee,
    await usersFor(workflow),
  );
  const changes = group.validateLabels(
    decoded.labels,
    await findDedupeReferences(command.caseType, session),
  );
  for (const [caseRef, label] of Object.entries(changes)) {
    const kase = await findByCaseRefAndWorkflowCode(
      caseRef,
      command.caseType,
      session,
    );
    const event = kase.recordDedupeLabel({ label, createdBy: command.user.id });
    if (event) await saveCaseLabel(kase, event, session);
  }
  if (ownerChanged) await saveGroupOwner(assignment, session);
  return {
    changedLabels: Object.keys(changes).length,
    redirectHref: summaryHref(command),
  };
};
const auditedSave = withAudit(save, auditFor(auditActions.SAVE_CASE_GROUP));
export const saveDedupeGroupUseCase = async (command) => {
  try {
    return await withTransaction((session) => auditedSave(command, session));
  } catch (error) {
    if (!(error instanceof DedupeError)) throw error;
    return {
      validationError: true,
      message: error.message,
      page: await detail(command, command.payload.form, error),
    };
  }
};
