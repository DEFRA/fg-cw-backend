import { logger } from "../src/common/logger.js";

// FGP-1582: grants-ui summed parcel areas in floating point, so some woodland
// cases show totals such as 270.54729999999995. Those are rounded to 4 decimal
// places, matching GAS, and each change is logged.

const WORKFLOW_CODE = "woodland";
const FIELD = "payload.answers.totalHectaresForSelectedParcels";
const DECIMAL_PLACES = 4;

const hectares = `$${FIELD}`;
const rounded = { $round: [hectares, DECIMAL_PLACES] };

const AFFECTED = {
  workflowCode: WORKFLOW_CODE,
  $expr: { $and: [{ $isNumber: hectares }, { $ne: [hectares, rounded] }] },
};

export const up = async (db) => {
  const cases = db.collection("cases");
  const affected = await cases
    .aggregate([
      { $match: AFFECTED },
      { $sort: { caseRef: 1 } },
      { $project: { _id: 0, caseRef: 1, from: hectares, to: rounded } },
    ])
    .toArray();

  const { modifiedCount } = await cases.updateMany(AFFECTED, [
    { $set: { [FIELD]: rounded } },
  ]);

  const details = affected
    .map(({ caseRef, from, to }) => `${caseRef} ${from} -> ${to}`)
    .join("; ");
  logger.info(
    `Rounded totalHectaresForSelectedParcels to ${DECIMAL_PLACES} decimal places on ${modifiedCount} ${WORKFLOW_CODE} cases${details ? `: ${details}` : ""}`,
  );
};
