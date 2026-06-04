# Local Workflow Definition Overrides

While developing or prototyping a workflow definition, reseeding MongoDB on every
change is slow. This feature lets you point a workflow `code` at a JSON file on
disk so the definition is loaded from the file instead of the database — no
migration, no reseed, no restart.

> **Local development only.** The override is ignored unless
> `cdpEnvironment` is `local`. It can never affect a deployed environment.

## How to use it

1. Put your workflow definition JSON somewhere on disk. The
   `test/fixtures/*-workflow-definition.json` files (or a `mongoexport` dump) are
   the right shape.

2. Create a **manifest** that maps workflow codes to definition files. A sample
   lives at [`dev-workflows/overrides.example.json`](../dev-workflows/overrides.example.json):

   ```json
   {
     "woodland": "./woodland.json"
   }
   ```

   File paths are resolved **relative to the manifest file's directory** (absolute
   paths also work).

3. Point the app at the manifest via the `WORKFLOW_OVERRIDES` environment variable
   (e.g. in `.env`):

   ```
   WORKFLOW_OVERRIDES=./dev-workflows/overrides.json
   ```

4. Run the app (`npm run dev`). Any workflow whose `code` appears in the manifest
   is now loaded from its file. Edit the file and refresh — the manifest and the
   definition files are **re-read on every lookup**, so changes are picked up live
   without restarting.

## What it affects

The override logic lives in
`src/cases/repositories/workflow/workflow-override.js` and is consulted by the
workflow repository (`src/cases/repositories/workflow.repository.js`), which is
the single point through which every workflow load passes. Both `findByCode`
(used by all case flows) and `findAll` (used by workflow listings) honour it.

### `findAll` only _replaces_ workflows already in the database

`findAll` overrides the definition for any code it finds in the database, but it
**does not inject override-only workflows** that aren't already seeded. In other
words, an override changes the _content_ of a workflow that the listing already
returns; it won't make a brand-new, never-seeded workflow appear in the list.

For prototyping the content of an existing workflow this is irrelevant —
`findByCode` works regardless of whether the workflow is seeded. If you need a
never-seeded workflow to show up in listings, seed a stub via migration (or ask
for `findAll` to be extended to merge in override-only codes).

## `_id` handling

Definition files usually have no `_id`, or carry one as a plain string or as
extended JSON (`{ "$oid": "..." }`) from a `mongoexport` dump. All three are
normalised to a real `ObjectId` when the file is loaded, so any of them works.

## Notes

- `WORKFLOW_OVERRIDES` is unset by default, so the feature is inert unless you opt
  in.
- Keep your manifest and definition files out of version control — the
  `dev-workflows/` directory is gitignored except for the committed example.
- This is a developer convenience only; production definitions are always seeded
  via migrations (see [`creating-workflow-definitions.md`](./creating-workflow-definitions.md)).
