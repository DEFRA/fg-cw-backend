import { answerListOf, parsePath } from "../../common/explore/paths.js";

// Answers a case's support questions read, whatever the workflows
// reference, relative to the answers. Changed by PR.
export const REVIEWED_PATHS = [
  "applicant.business.name",
  "applicant.customer.name",
  "applicantName",
  "applicant.business.email",
  "applicant.business.email.address",
  "applicant.customer.email.address",
  "applicantEmail",
  "application.parcel.parcelId",
  "parcels.parcelId",
  "landParcels.parcelId",
  "landParcels",
  "selectedParcelId",
  "application.parcel.sheetId",
  "application.parcel.area.quantity",
  "landParcels.areaHa",
  "parcels.actions.value",
  "parcels.actions.unit",
  "existingWmps",
  "application.parcel.actions.code",
  "parcels.actions.code",
  "actionCode",
  "application.parcel.actions.appliedFor.quantity",
];

// As many as Caseworking's sources answer may carry.
export const MAX_ANSWER_PATHS = 2000;

const REFERENCE = /\$\.payload\.answers(\.[\w-]+(?:\.[\w-]+|\[[^\]$]*\])*)/g;

const POSITION = /^\d+$/;

// Each [...] dropped: a reference only holds closed ones.
const withoutBrackets = (steps) =>
  steps
    .split("[")
    .map((piece, n) => (n === 0 ? piece : piece.slice(piece.indexOf("]") + 1)))
    .join("");

const withoutPositions = (path) =>
  path
    .split(".")
    .filter((name) => !POSITION.test(name))
    .join(".");

// Every reference in a definition's text, each up to its first step that
// isn't a name or a plain [...]: "$.payload.answers.parcels[0].id" is
// "parcels.id". A bare "$.payload.answers", or one filtered at its root,
// is no one answer.
const referencedPathsOf = (workflow) =>
  [...JSON.stringify(workflow).matchAll(REFERENCE)]
    .map(([, steps]) => withoutPositions(withoutBrackets(steps).slice(1)))
    .filter((path) => parsePath(path) !== null);

// The answers of a case Explore may read: the reviewed paths, then those the
// workflows' stored definitions reference, at most MAX_ANSWER_PATHS of them.
export const answerListFrom = (workflows) => {
  const found = [
    ...new Set([...REVIEWED_PATHS, ...workflows.flatMap(referencedPathsOf)]),
  ];
  const paths = found.slice(0, MAX_ANSWER_PATHS);

  return {
    paths,
    cut: found.length > paths.length,
    isListed: answerListOf(paths),
  };
};
