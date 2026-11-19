import { findBucket } from "../../common/buckets/registry.js";
import {
  findExploreSource,
  listExploreSources,
} from "../../common/explore-sources/registry.js";

const ORDER = ["cases", "workflows", "events"];

const rank = ({ name }) => {
  const at = ORDER.indexOf(name);

  return at === -1 ? ORDER.length : at;
};

const withBucket = (box) => ({
  ...box,
  id: box.bucket,
  bucket: findBucket(box.bucket),
});

// A source with its buckets read from the registry, which every module has
// filled by the time a query arrives.
const resolved = (source) => ({
  ...source,
  ...(source.bucket && { bucket: findBucket(source.bucket) }),
  ...(source.boxes && { boxes: source.boxes.map(withBucket) }),
});

export const ownSources = () =>
  listExploreSources()
    .toSorted((a, b) => rank(a) - rank(b))
    .map(resolved);

export const findOwnSource = (name) => {
  const source = findExploreSource(name);

  return source ? resolved(source) : null;
};
