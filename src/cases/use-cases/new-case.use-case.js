import { logger } from "../../common/logger.js";
import { CasePhase } from "../models/case-phase.js";
import { Case } from "../models/case.js";
import { save } from "../repositories/case.repository.js";
import { createCaseStage } from "./ensure-case-position.use-case.js";
import { findWorkflowByCodeUseCase } from "./find-workflow-by-code.use-case.js";

const temporaryCaveatSourceMap = {
  "hefer-consent-required": "historic-england",
  "ne-consent-required": "natural-england",
};

// eslint-disable-next-line complexity
const mapCaveatSources = (payload) => {
  const caveats = payload?.answers?.rulesCalculations?.caveats;

  if (!Array.isArray(caveats)) {
    return payload;
  }

  return {
    ...payload,
    answers: {
      ...payload.answers,
      rulesCalculations: {
        ...payload.answers.rulesCalculations,
        caveats: caveats.map((caveat) => ({
          ...caveat,
          source: temporaryCaveatSourceMap[caveat.code] ?? caveat.source,
        })),
      },
    },
  };
};

export const newCaseUseCase = async (message, session) => {
  const {
    event: { data },
  } = message;
  const { caseRef, workflowCode } = data;
  const payload = mapCaveatSources(data.payload);

  logger.info(
    `Creating new case with caseRef ${caseRef} and workflowCode ${workflowCode}`,
  );

  const workflow = await findWorkflowByCodeUseCase(workflowCode);

  const position = workflow.getInitialPosition();

  const root = { payload };
  const [firstWorkflowPhase] = workflow.phases;
  const [firstWorkflowStage] = firstWorkflowPhase.stages;

  const firstStage = await createCaseStage(firstWorkflowStage, root);
  const phases = [
    new CasePhase({
      code: firstWorkflowPhase.code,
      stages: [firstStage],
    }),
  ];

  const kase = Case.new({
    caseRef,
    workflowCode,
    position,
    payload,
    phases,
  });

  const { insertedId } = await save(kase, session);

  logger.info(
    `Finished: Creating new case with caseRef ${caseRef} and workflowCode ${workflowCode}`,
  );

  return insertedId;
};
