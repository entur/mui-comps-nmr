# CLAUDE.md

`@entur/mui-comps-nmr` — small React MUI component lib for Entur's
[hathor](https://github.com/entur/hathor) frontend. Types come from live
[sobek](https://github.com/entur/sobek) GraphQL schema. Previewed w/ Storybook.
Status: seed, unpublished. Storybook deploys to GitHub Pages.

## Core

Two layers. **Presentational**: `createAbstractEntityDetailsForm<E>(fields)` →
typed React form. No data fetch, no save, no i18n runtime, no router.
**Data-aware**: generated wrappers `VehicleForm` / `VehicleTypeForm` (from
`scripts/generateWrappers.ts`, one per `entities.manifest.json` entry) wrap it
and do load/save over sobek GraphQL via the internal `useEntityForm` hook.
Public API in `src/index.ts`. `src/EntityDetailsForm/formImpls/*` is generator
output — **never hand-edit**; fix the template in `generateWrappers.ts` and
re-run it.

`SobekProvider` (`src/context/SobekContext.tsx`) is a typed FC, not the raw
`Context.Provider`: `value: SobekCtx` is required, so a host threading a
possibly-undefined session is a compile error rather than a render-time throw
from inside a consumer. It memoizes per field, so an inline object literal
doesn't re-render every consumer.

`useEntityForm` contract (not exported; `src/EntityDetailsForm/hooks/`):
session inputs come from the **mandatory `SobekProvider`** (`endpoint`,
`headers`, `getHeaders`, `dataOwnerRef`) — wrappers no longer take them as
props, and the hook throws when no provider is above. Headers resolved **per
request** (`headers` + `getHeaders` ref-guarded, dynamic wins over static) so
inline literals never re-trigger a load; `dataOwnerRef` is the opposite — it
joins the load-effect deps so an org switch re-fires every mounted load.
`dataOwnerRef` is stamped onto the mutation input from context at the wire
edge (never from form state) and filters both the load and the post-save
refetch — but only when the entity's `FIELDS` actually carries `dataOwnerRef`
as `locked` (registry-driven, not by key name: an Input without it must not
get one). `netexId` set → `undefined` keeps `value` and retires the in-flight
load; it does not blank the form. Load settled-ness is a separate `load`
phase (`idle|pending|ok|error`) returned by the hook — `loading` alone is
false on the first commit (`LOAD_START` fires from a passive effect), so
gating not-found on it flashed `Not found` on every mount. `load === 'ok'`
+ no value renders `Not found: <netexId>`; `load === 'error'` renders
`errors.__init` instead, so a failed load is never reported as a missing
record. **Both halves fail alike**: load and save each normalize the thrown
error, hand the server's own messages to `onError`, and fall back to a constant
(`'Failed to load'` / `'Failed to save'`) only when the payload carries no
GraphQL `errors` array. Load messages also land in `errors.__init`, joined by
`'; '` (it renders as one line; `onError` gets them unjoined). The load path
normalizes against an **empty** registry — a query takes a netexId, not an
`input`, so every message is general by construction and none can be lost to
field routing. Its `onError` is ref-held (an inline host arrow in the effect
deps would re-fire the load) and epoch-guarded — the reducer discards a stale
dispatch on its own, but a callback into host code has no such protection, so a
retired or superseded load would otherwise pop an error for a form that has
moved on. Stale
responses guarded by a reducer `epoch`; `saving` is released on
unmount-check alone, never gated on that epoch.

**Host observation** (`onChange` / `onDirtyChange`, both optional, both
ref-held so an inline arrow can't re-fire the effects). `onChange` fires on
*every* value change — load and post-save refetch included, not just edits — so
a host header can show the loaded name without waiting for a keystroke.
Observation only: the hook keeps owning the value, and feeding it back in as a
prop is unsupported (it would reintroduce the load/epoch races). Dirty is
computed against a `baseline` in reducer state, set by `LOAD_SUCCESS` and
`SAVE_SUCCESS` — so a saved form is clean without the host re-baselining. The
comparison (`src/EntityDetailsForm/dirty.ts`) treats `undefined | null | false |
'' | []` as one value, which is what stops an untouched Switch reporting `false`
against a null-backed baseline, or a text field typed into and cleared, from
reading as edits. `0` is deliberately not empty. Both callbacks reach the hook
through the generated wrapper's `...rest`, so the generator only declares them
on `<Entity>FormProps` — nothing else in the template changes.

- `mode` `'view' | 'edit'` — view disables inputs.
- `layout?` — whitelist of sections (`{ Section: [fields] }`). Omitted field not
  rendered but value round-trips via `onChange` (loss-free). Omit layout → flat.
- `variant?` `'tabs' | 'stacked'` — for ≥2 sections. Default `tabs`.
- `serverManaged` fields (`version`, `created`, `changed`, `changedBy`) hidden
  from editable model: locked even in edit, surfaced only to *see* meta/semantic
  context. Backend-owned — **not round-tripped**, never in write payload, don't
  travel back as edits. (vs ordinary omitted field, whose value *does* pass
  through `onChange`.) Stale after save — client refetches.
- `locked` fields (`dataOwnerRef`) — client-supplied but not user-editable:
  rendered and always disabled even in edit, **never sourced from form state**
  into the write payload (the host supplies the value at the wire edge — the
  hook stamps `dataOwnerRef` from context, so it *is* sent, just never from
  the edited entity). Errors on them route to `generalErrors`. Distinct from
  `serverManaged`: that means backend-owned and is *derived* by distill from
  the Entity/Input diff; `locked` is assigned explicitly via distill's
  `LOCKED_FIELDS` set (carried through the `reference` fast-path too, so a
  locked write-as-reference relation stays locked). The wrapper overlays the
  context value for display on **every** render
  (`{ ...(value ?? {}), dataOwnerRef }`), not just while `value` is undefined
  — otherwise the control keeps showing the org current at first keystroke
  while the save stamps the new one.
- Labels default to humanized key. Override per-field `{ field, label }`. No i18n
  dep — localization is client's job.
- `grid` fields render array-of-obj relations as a read-only table; cols
  auto-derived from row data. Layout entry `entries` (`{ field, label }[]`, `field`
  = row-obj key) fixes col order + labels. Grid omits its own caption when alone
  in a section (tab/heading names it), shows it when beside other fields.
- `reference` fields edit a single relation by its identity leaf. With a layout
  entry `options` (`() => { value, label }[]`, value = referenced netexId) →
  single-select Autocomplete; omit (incl. zero-config) → free-text id field.
  Selection writes the `netexId` leaf; round-trips as the full relation object.
- `date` / `datetime` render native `<input type=date|datetime-local>` (no date
  dep). `datetime` value is the stored ISO sliced to `YYYY-MM-DDTHH:mm`.
- `slotProps?` (form-level) — per-`kind` MUI overrides. TextField-backed kinds
  (`text|number|name|enum|date|datetime`) take TextField `slotProps` (merged over
  the label-shrink default); `enumMulti`→Autocomplete, `switch`→`SwitchProps`,
  `grid`→`{ dataGrid }`. Per-field override is a planned later addition.

## GraphQL → TS pipeline

Never hand-maintain entity shapes. Generate from live schema, distill to
per-entity modules.

- Schema URL: `https://entur.github.io/sobek/schema.graphqls`
- `npm run codegen` — download schema (`scripts/fetchSchema.ts`) → emit
  `src/generated/sobekTypes.ts` (types + runtime enums). Git-ignored artifact.
- `npm run distill` (chains codegen) — parse generated types → write **committed**
  `src/entities/*`. Each: `Entity` type (verbatim, nested), `FIELDS` registry
  (flat addressable map; value-object leaves hoisted w/ `path`; carries `kind`,
  `path`, `options`, `serverManaged`, `locked`).
  `kind` ∈ `text|number|name|switch|enum|enumMulti|grid|reference|date|datetime`.
  `serverManaged` **derived** = on `Entity`, not on `Input` (no client tag).
  `locked` **assigned** = member of distill's `LOCKED_FIELDS` set
  (`dataOwnerRef`) and not serverManaged (serverManaged wins on overlap).
  Array-of-identity-objects (e.g. `vehicles`) → one `grid` field (read-only
  table, `ObjectGrid`/MUI X Data Grid; always serverManaged). **Read-object /
  write-reference divergence**: a single relation whose same-named `Input` member
  is a *pure reference* (members ⊆ `{id, netexId}`, e.g. `transportType`/`deckPlan`
  via `*ReferenceInput`) → one `reference` field on the identity leaf (writable,
  not serverManaged; the fast-path `continue`s before `deriveFields`, so it must
  apply `locked` itself). Other single relations + id-less object arrays (e.g.
  `keyValues`) get no `FIELDS` entry but stay on `Entity`. Edits write one leaf by
  `path`, never whole object — so scalar edit can't drop a relation, and edited
  `value` round-trips as complete entity. `src/entities/index.ts` re-exports per
  entity name.

### Patch overlay

`schema/sobek.patch.graphqls` — committed SDL overlay applied before codegen,
for fields the live schema hasn't shipped. Currently `manufacturer`, `range`,
`fullCharge`, `carLoading` on VehicleType. Extends **both** `type VehicleType`
and `input VehicleTypeInput`: the read half satisfies distill's "Input ⊆ Entity"
check, the input half keeps the field out of `serverManaged` (derived = on
`Entity`, not on `Input`) — read-only extend ⇒ permanently locked control. When
sobek ships a field for real, delete matching `extend` lines by hand (done for
`dataOwnerRef`, now a real read field).

**Invariant: the patch is an input to `codegen.ts` only.** Wire-facing
generators (`scripts/generateDocuments.ts`, `codegen-operations.ts`) read
`sobek.schema.graphqls` alone, so a patched field is absent from every selection
set by construction — no prune list to drift. Dropping the patch from
`codegen-operations.ts` also makes it *validate* documents against the live
schema, so a leak fails codegen instead of the backend (nothing else catches it:
`src/stories/mockEndpoint.ts` is a schema-free `fetch` interceptor).

The write half can't be fixed by a document — `$input` is a runtime variable —
so `generateDocuments` emits `src/generated/operations/inputKeys.ts`, one
`<Entity>InputKeys` mask per manifest entity read from the live schema's
`<Entity>Input`. `useEntityForm` applies it via `reduceToSobekInput(inp, mask)`
right after `toInputEntity`, before the `dataOwnerRef` stamp (a wire field, so
unaffected). The `satisfies Record<keyof <Entity>Input, 1>` on each mask is a
real guard, not decoration: keys come from `generateDocuments`' schema read, the
type from graphql-codegen's — feed the patch to either and the build fails.
`distillTypes.ts` and `toInput.ts` are deliberately untouched, so patched fields
stay editable and round-trip through `onChange`; only the wire edge strips them.
Residue: `Types.<Entity>Input` in `sobekTypes.ts` stays patched, so the
*variables type* still permits those keys at compile time — only the runtime
mask stops them.

## Tests

Vitest + Testing Library, jsdom. `npm run test` — `pretest` runs `generate`
(→ `distill` → `codegen`), so the suite always runs against freshly generated
wrappers and entities. Corollary: a hand-edit under `formImpls/` is silently
wiped by `npm test`.

**Never write a test per generated entity.** Anything covering generator output
is driven by `entities.manifest.json`, so a new entity is covered the moment it
is generated: `formImpls/wrappers.test.tsx` does `describe.each` over the
manifest and resolves each component from the generated `formImpls/index.ts`
barrel (`${Entity}Form`) and its registry from the `entities` barrel
(`${camel}Fields`). Everything entity-shaped is derived — `queryRoot` builds the
mock response, locked fields come from `FIELDS`, labels from `humanize(key)`. No
entity literals in the assertions. It throws when a manifest entry has no
exported wrapper or no registry, so a broken generator run fails loudly rather
than silently skipping. (`vehicleForm.test.tsx` was the anti-pattern: VehicleType
shipped untested because nobody wrote the sibling file.)

Two techniques worth keeping:

- **First-commit assertions need `flushSync` on a bare `createRoot`**, not RTL's
  `render` — `render` wraps in `act()`, which flushes passive effects before it
  returns and hides anything that only exists on the first commit (this is what
  masked the `Not found` flash). `flushSync` commits synchronously and leaves
  passive effects scheduled.
- **A regression test must be seen failing against the pre-fix code.** The
  original `Not found` test passed vacuously — its `waitFor` was satisfied by the
  flash it was meant to forbid. Revert the fix, watch it fail, restore.

`scripts/*.test.ts` test the generator/distiller as string transforms (assert on
emitted source), so template changes are pinned without running codegen.

## Build

`npm run build` — Vite library mode → `dist/`. Emits ESM (`index.js`), CJS
(`index.cjs`), types (`index.d.ts` via `vite-plugin-dts`). React/MUI/Emotion +
`graphql-request` are externalized peer deps — host owns single copy (avoids
"two Reacts"). React 19, MUI 7, Emotion 11 pinned to match hathor.
`graphql` is never imported directly (only through `graphql-request`), so
externalizing the client keeps the graphql runtime out of `dist` too — no
`dependencies` block at all now.
