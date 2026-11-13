import {
  describeSource,
  knownValuesOf,
} from "../../common/explore/describe.js";
import { QUERY_VERSIONS } from "../../common/explore/query-schema.js";
import { loadAnswerListUseCase } from "./load-answer-list.use-case.js";
import { ownSources } from "../explore/sources.js";

// A source with answers names those Explore may read of them.
const answerPathsOf = async (described) =>
  described.listedAt
    ? { answerPaths: (await loadAnswerListUseCase()).paths }
    : {};

const withValues = async (source) => {
  const described = describeSource(source);
  const [values, answerPaths] = await Promise.all([
    knownValuesOf(source),
    answerPathsOf(described),
  ]);

  return {
    ...described,
    ...answerPaths,
    paths: described.paths.map((entry) =>
      values.has(entry.path)
        ? { ...entry, values: values.get(entry.path) }
        : entry,
    ),
  };
};

// The Query versions Caseworking reads, and its sources as GAS checks queries
// against them: what each may read, each closed path with the values it is
// known to hold, and the answer paths a Query may read.
export const exploreSourcesUseCase = async () => ({
  versions: QUERY_VERSIONS,
  sources: await Promise.all(ownSources().map(withValues)),
});
