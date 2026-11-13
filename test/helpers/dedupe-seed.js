import { readFile } from "node:fs/promises";
import { Case } from "../../src/cases/models/case.js";
import { CasePhase } from "../../src/cases/models/case-phase.js";
import { CaseSeries } from "../../src/cases/models/case-series.js";
import { Position } from "../../src/cases/models/position.js";
import { Workflow } from "../../src/cases/models/workflow.js";
import { save as saveCase } from "../../src/cases/repositories/case.repository.js";
import { save as saveSeries } from "../../src/cases/repositories/case-series.repository.js";
import { createCaseStage } from "../../src/cases/use-cases/ensure-case-position.use-case.js";
import { save as saveWorkflow } from "../../src/cases/repositories/workflow.repository.js";
import { db } from "../../src/common/mongo-client.js";
import { IdpRoles } from "../../src/users/models/idp-roles.js";
import { User } from "../../src/users/models/user.js";
import { save as saveUser } from "../../src/users/repositories/user.repository.js";
import { up } from "../../migrations/20261112160000-create-case-groups.js";
import { seedConfigVersion, FetchStatus } from "./config-versions.js";

export const dedupeTab = JSON.parse(
  await readFile(new URL("../fixtures/dedupe-page.json", import.meta.url)),
);
export const seedDedupe = async () => {
  const definition = JSON.parse(
    await readFile(
      new URL("../fixtures/frps-workflow-definition.json", import.meta.url),
    ),
  );
  definition.code = "frps-private-beta";
  definition.requiredRoles = { allOf: [], anyOf: [] };
  definition.pages["case-list"] = {
    tabs: { duplicates: structuredClone(dedupeTab) },
  };
  const workflow = Workflow.fromDefinition(definition, "1.0.0");
  await saveWorkflow(workflow);
  await seedConfigVersion(db, workflow.code, "1.0.0", {
    fetchStatus: FetchStatus.Fetched,
  });
  const user = User.createMock({
    idpId: "df20f4bd-d009-4bf4-b499-46e93e0f005a",
    name: "Test ReaderWriter",
    email: "readerwriter@t.gov.uk",
    appRoles: {},
    idpRoles: [IdpRoles.ReadWrite],
  });
  await saveUser(user);
  const addCase = async (caseRef, sbi, overrides = {}) => {
    const position =
      overrides.position ??
      new Position({
        phaseCode: "PRE_AWARD",
        stageCode: "REVIEW_APPLICATION",
        statusCode: "IN_REVIEW",
      });
    const payload = {
      identifiers: { sbi },
      answers: { applicant: { business: { name: `Farm ${sbi}` } } },
    };
    const stage = await createCaseStage(workflow.getStage(position), {
      payload,
    });
    const kase = Case.new({
      workflowCode: workflow.code,
      caseRef,
      configVersion: "1.0.0",
      phases: [new CasePhase({ code: position.phaseCode, stages: [stage] })],
      position,
      payload,
    });
    kase.createdAt = `2026-11-${String((Number(caseRef.slice(-2)) % 9) + 1).padStart(2, "0")}T10:00:00.000Z`;
    await saveCase(kase);
    await saveSeries(
      CaseSeries.new({
        workflowCode: workflow.code,
        caseRef,
        caseId: kase._id,
      }),
    );
    return kase;
  };
  for (const [ref, sbi] of [
    ["300241", "244666513"],
    ["300242", "244666513"],
    ["300244", "244666514"],
    ["300245", "244666514"],
    ["300246", "244666515"],
    ["300247", "244666515"],
    ["300248", "single"],
    ["300249", null],
    ["300250", null],
  ])
    await addCase(ref, sbi);
  await addCase("300243", "244666513", {
    position: new Position({
      phaseCode: "PRE_AWARD",
      stageCode: "REVIEW_APPLICATION",
      statusCode: "APPLICATION_REJECTED",
    }),
  });
  await up(db);
  return { user, workflow, addCase };
};
