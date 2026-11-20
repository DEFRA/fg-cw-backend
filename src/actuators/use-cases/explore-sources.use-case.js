import {
  describeSource,
  knownValuesOf,
} from "../../common/explore/describe.js";
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

// Caseworking's sources as GAS checks queries against them: each one's known
// paths, how each is indexed, and the values each closed path is known to
// hold.
export const exploreSourcesUseCase = async () => ({
  sources: await Promise.all(ownSources().map(withValues)),
});
