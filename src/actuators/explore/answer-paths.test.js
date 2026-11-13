import { describe, expect, it } from "vitest";
import { sourcesSchema } from "../../common/explore/query-schema.js";
import {
  MAX_ANSWER_PATHS,
  REVIEWED_PATHS,
  answerListFrom,
} from "./answer-paths.js";

const workflowWith = (...texts) => ({
  code: "woodland",
  pages: { rows: texts.map((text) => ({ text })) },
});

const listedFrom = (...texts) =>
  answerListFrom([workflowWith(...texts)]).paths.filter(
    (path) => !REVIEWED_PATHS.includes(path),
  );

describe("answerListFrom", () => {
  it("lists the reviewed paths, and what is below them", () => {
    const { isListed } = answerListFrom([]);

    expect(isListed("applicant.business.name")).toBe(true);
    expect(isListed("parcels.actions.unit")).toBe(true);
    expect(isListed("landParcels.0.areaHa")).toBe(true);
    expect(isListed("woodlandName")).toBe(false);
    expect(isListed("applicant.business")).toBe(false);
  });

  it("lists every answer its workflows reference, wherever in their text", () => {
    expect(
      listedFrom(
        "$.payload.answers.woodlandName",
        "$.payload.answers.hectaresUnderTenYearsOld ha",
        "$.payload.answers.applicant.customer.name.first & ' ' & $.payload.answers.applicant.customer.name.last",
      ),
    ).toEqual([
      "woodlandName",
      "hectaresUnderTenYearsOld",
      "applicant.customer.name.first",
      "applicant.customer.name.last",
    ]);
  });

  it("drops plain [...] steps, and reads a reference inside brackets on its own", () => {
    expect(
      listedFrom(
        "$.payload.answers.payments.parcel[*].actions[0].code",
        "agreement[code in $.payload.answers.rates[*].code].rate",
        "$.payload.answers.totals[code in $.payload.answers.codes].value",
      ),
    ).toEqual([
      "payments.parcel.actions.code",
      "rates.code",
      "totals",
      "codes",
    ]);
  });

  it.each([
    ["a bare reference", "$.payload.answers"],
    ["a filter at the root", "$.payload.answers[?(@property == 'x')].y"],
    ["a denied answer", "$.payload.answers.applicant.bank.sortCode"],
    ["an inherited name", "$.payload.answers.__proto__.x"],
    ["another root", "$.payload.identifiers.sbi"],
  ])("lists nothing for %s", (_, text) => {
    expect(listedFrom(text)).toEqual([]);
  });

  it("reads every name the path grammar allows, as far as it allows", () => {
    expect(
      listedFrom(
        "$.payload.answers.2ndChoice",
        "$.payload.answers.parcels.2ndChoice.area",
        "$.payload.answers.land-parcels.0.id",
      ),
    ).toEqual(["2ndChoice", "parcels.2ndChoice.area", "land-parcels.id"]);
  });

  it("stops at as many paths as its sources answer may carry, and says so", () => {
    const texts = Array.from(
      { length: MAX_ANSWER_PATHS },
      (_, n) => `$.payload.answers.answer${n}`,
    );

    const list = answerListFrom([workflowWith(...texts)]);

    expect(list.paths).toHaveLength(MAX_ANSWER_PATHS);
    expect(list.paths.slice(0, REVIEWED_PATHS.length)).toEqual(REVIEWED_PATHS);
    expect(list.cut).toBe(true);
    expect(answerListFrom([]).cut).toBe(false);
  });

  it("is as long as the sources answer allows, and no longer", () => {
    const answerPaths = (length) =>
      Array.from({ length }, (_, n) => `answer${n}`);
    const sourcesWith = (paths) => ({
      versions: [2],
      sources: [
        {
          name: "cases",
          label: "Cases",
          service: "CW",
          size: "big",
          noun: { one: "case", many: "cases" },
          star: [],
          time: "createdAt",
          roots: ["payload"],
          answersAt: "payload.answers",
          listedAt: "payload.answers",
          requires: null,
          paths: [],
          answerPaths: paths,
        },
      ],
    });

    expect(
      sourcesSchema.validate(sourcesWith(answerPaths(MAX_ANSWER_PATHS))).error,
    ).toBeUndefined();
    expect(
      sourcesSchema.validate(sourcesWith(answerPaths(MAX_ANSWER_PATHS + 1)))
        .error,
    ).toBeDefined();
  });
});
