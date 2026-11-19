import {
  describeSource,
  knownValuesOf,
} from "../../common/explore/describe.js";
import { QUERY_VERSIONS } from "../../common/explore/query-schema.js";
import { ownSources } from "../explore/sources.js";

const withValues = async (source) => {
  const described = describeSource(source);
  const values = await knownValuesOf(source);

  return {
    ...described,
    paths: described.paths.map((entry) =>
      values.has(entry.path)
        ? { ...entry, values: values.get(entry.path) }
        : entry,
    ),
  };
};

// The Query versions Caseworking reads, and its sources as GAS checks queries
// against them: what each may read, and each closed path with the values it
// is known to hold.
export const exploreSourcesUseCase = async () => ({
  versions: QUERY_VERSIONS,
  sources: await Promise.all(ownSources().map(withValues)),
});
