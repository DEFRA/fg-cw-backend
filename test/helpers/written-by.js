// The running service sweeps a RESUBMITTED row on to PUBLISHED, then claims and
// fails it, within a 250 ms poll, so a row read back after a write races the
// poller. The post-image of the write's own change does not.
export const keepPostImages = (db, ...names) =>
  Promise.all(
    names.map((collMod) =>
      db.command({ collMod, changeStreamPreAndPostImages: { enabled: true } }),
    ),
  );

// The row as the first update to it during `write` left it.
export const writtenBy = async (collection, _id, write) => {
  const stream = collection.watch(
    [{ $match: { operationType: "update", "documentKey._id": _id } }],
    { fullDocument: "required" },
  );

  try {
    // Opens the cursor, so the stream starts before the write does.
    await stream.tryNext();
    await write();

    return (await stream.next()).fullDocument;
  } finally {
    await stream.close();
  }
};
