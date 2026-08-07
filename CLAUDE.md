# CLAUDE.md

`@entur/mui-comps-nmr` — small React MUI component lib for Entur's
[hathor](https://github.com/entur/hathor) frontend. Types come from live
[sobek](https://github.com/entur/sobek) GraphQL schema. Previewed w/ Storybook.
Status: seed, unpublished. Storybook deploys to GitHub Pages.

## Core

Two layers. **Presentational**: `createAbstractEntityDetailsForm<E>(fields)` →
typed React form. No data fetch, no save, no i18n runtime, no router.
**Data-aware**: generated wrappers `VehicleForm` / `VehicleTypeForm` (from
`scripts/generateWrappers.ts`) wrap it and do load/save over sobek GraphQL via
the internal `useEntityForm` hook. Public API in `src/index.ts`.

`useEntityForm` contract (not exported; `src/EntityDetailsForm/hooks/`):
session inputs come from the **mandatory `SobekProvider`** (`endpoint`,
`headers`, `getHeaders`, `dataOwnerRef`) — wrappers no longer take them as
props, and the hook throws when no provider is above. Headers resolved **per
request** (`headers` + `getHeaders` ref-guarded, dynamic wins over static) so
inline literals never re-trigger a load; `dataOwnerRef` is the opposite — it
joins the load-effect deps so an org switch re-fires every mounted load.
`dataOwnerRef` is stamped onto the mutation input from context at the wire
edge (never from form state) and filters both the load and the post-save
refetch. `netexId` set → `undefined` keeps `value` and retires the in-flight
load; it does not blank the form. A settled zero-row load renders
`Not found: <netexId>` instead of a blank editable form. Save failures with
no GraphQL `errors` array fall back to `onError(['Failed to save'])`. Stale
responses guarded by a reducer `epoch`; `saving` is released on
unmount-check alone, never gated on that epoch.

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
  rendered and always disabled even in edit, never in the write payload,
  errors on them route to `generalErrors`. Distinct from `serverManaged`:
  that means backend-owned and is *derived* by distill from the Entity/Input
  diff; `locked` is assigned explicitly via distill's `LOCKED_FIELDS` set.
  In create mode the wrapper renders the context value via a display-only
  fallback (`value ?? ({ dataOwnerRef } as Entity)`) — it never reaches the
  server from form state.
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
  `path`, `options`, `serverManaged`).
  `kind` ∈ `text|number|name|switch|enum|enumMulti|grid|reference|date|datetime`.
  `serverManaged` **derived** = on `Entity`, not on `Input` (no client tag).
  `locked` **assigned** = member of distill's `LOCKED_FIELDS` set
  (`dataOwnerRef`) and not serverManaged (serverManaged wins on overlap).
  Array-of-identity-objects (e.g. `vehicles`) → one `grid` field (read-only
  table, `ObjectGrid`/MUI X Data Grid; always serverManaged). **Read-object /
  write-reference divergence**: a single relation whose same-named `Input` member
  is a *pure reference* (members ⊆ `{id, netexId}`, e.g. `transportType`/`deckPlan`
  via `*ReferenceInput`) → one `reference` field on the identity leaf (writable,
  not serverManaged). Other single relations + id-less object arrays (e.g.
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
`Entity`, not on `Input`) — read-only extend ⇒ permanently locked control. Types
deliberately ahead of live read schema — safe, lib runs no GraphQL ops. When
sobek ships a field for real, delete matching `extend` lines by hand (done for
`dataOwnerRef`, now a real read field).

## Build

`npm run build` — Vite library mode → `dist/`. Emits ESM (`index.js`), CJS
(`index.cjs`), types (`index.d.ts` via `vite-plugin-dts`). React/MUI/Emotion are
externalized peer deps — host owns single copy (avoids "two Reacts"). React 19,
MUI 7, Emotion 11 pinned to match hathor.
