# @entur/nmr-comps

A small React component library for Entur's **NMR** (Nasjonalt Materiellregister
— National Vehicle Registry). Components are built on [MUI](https://mui.com) and
typed directly from the live [sobek](https://github.com/entur/sobek) GraphQL
schema. Documented and previewed with [Storybook](https://storybook.js.org).

> Status: seed. The library ships a generic `createEntityDetailsForm` factory;
> per-entity bindings (`vehicleTypeFields`, `vehicleFields`) are generated from
> the live schema. Not published to a package registry yet; the Storybook is
> deployed to GitHub Pages.

## Components

### `createEntityDetailsForm<E>(fields)`

The library is **factory-only** — it ships no premade, hand-named form
components. You call `createEntityDetailsForm` with a field registry and get
back a typed React component. Name it whatever fits your UI. No data fetching,
no save logic, no i18n runtime, no router — drop it into any MUI app.

```tsx
import { createEntityDetailsForm, vehicleTypeFields, type VehicleType, type VehicleTypeLayout } from '@entur/nmr-comps';

const VehicleTypeForm = createEntityDetailsForm<VehicleType>(vehicleTypeFields);

const layout: VehicleTypeLayout = {
  Edit: ['name', 'shortName', 'length'],
  Capacity: ['totalCapacity', 'seatingCapacity', 'fareClass'],
};
// <VehicleTypeForm value={v} onChange={setV} mode="edit" layout={layout} variant="tabs" />
```

| Prop | Type | Notes |
| --- | --- | --- |
| `value` | `E` | Current entity value (the generated read type — see below). |
| `onChange` | `(next: E) => void` | Fired with the merged value on every edit. |
| `mode` | `'view' \| 'edit'` | `'view'` disables all inputs. |
| `layout?` | `Layout<EntityField>` | Whitelist of sections (see below). Omitted → flat, all fields rendered. |
| `variant?` | `'tabs' \| 'stacked'` | How ≥2 sections are presented. Default: `'tabs'`. |

#### Layout contract

`layout` is a **whitelist of sections**: each key becomes a section label; its
array is the ordered list of fields to render in that section. A layout item is
either a bare field key or `{ field, label }` to override the default label:

```ts
const layout: VehicleTypeLayout = {
  Identity: ['name', 'shortName', { field: 'dataOwnerRef', label: 'Owner' }],
  Dimensions: ['length', 'height', 'width', 'weight'],
};
```

Key points:

- **Loss-free omission** — a field omitted from `layout` is not rendered, but
  its value passes through `onChange` untouched. Omitting a field never drops
  data.
- **Omit `layout` entirely** — renders all fields in a flat single panel.
- **Single section renders flat** — no tab bar or panel header; the section key
  is ignored visually.
- **`variant`** — when there are ≥2 sections, `'tabs'` (default) shows a tab
  bar with one panel visible at a time; `'stacked'` renders all panels top-to-bottom.
- **`serverManaged` fields** — fields flagged `serverManaged` (backend-owned:
  `version`, `created`, `changed`, `changedBy`) render locked even in `edit`
  mode. Their values are stale after a successful save; the client is responsible
  for refetching.
- **Labels** — every label defaults to a humanized version of the field key
  (`seatingCapacity` → "Seating Capacity"). Override per-field via `{ field, label }`
  in the layout entry. There is **no i18n dependency** — localization is entirely
  the client's responsibility via the `label` override.

## The GraphQL → TypeScript pipeline

The library never hand-maintains entity shapes. It generates TypeScript from the
**live sobek schema** using
[The Guild's GraphQL Code Generator](https://the-guild.dev/graphql/codegen),
then distils that into per-entity modules.

- **Canonical schema URL:** `https://entur.github.io/sobek/schema.graphqls`
- `npm run codegen` downloads that schema (`scripts/fetchSchema.ts`) and emits
  `src/generated/sobekTypes.ts` containing all entity types and enums
  (`PropulsionType`, `FuelType`, `HybridCategory`, `TransportMode`, `FareClass`,
  …). Enums are emitted as **runtime** TypeScript enums so the form both
  type-checks against them and lists their members in dropdowns.
- The generated file and the downloaded schema are **git-ignored** — they are
  build artifacts, not source.

### The distill step

`npm run distill` (which chains `npm run codegen`) parses
`src/generated/sobekTypes.ts` and writes **committed** per-entity modules to
`src/entities/*`. Each module contains:

- **`Entity` type** — the full read entity type, verbatim (nested structure
  preserved for value round-tripping).
- **`FIELDS` registry** — a flat, addressable map of every renderable field.
  Value-object leaves (e.g. `passengerCapacity.seatingCapacity`) are hoisted
  into individually-addressable entries with their access path (`path:
  ['passengerCapacity', 'seatingCapacity']`). Each entry carries:
  - `kind` — the control family (`text`, `number`, `name`, `switch`, `enum`,
    `enumMulti`).
  - `path` — access path into the entity value.
  - `options` — enum member list (for `enum`/`enumMulti`).
  - `serverManaged` — present on backend-owned fields.
- **Relations and array-of-objects** (e.g. `vehicles`) are omitted from
  `FIELDS` but kept on the `Entity` type so they round-trip untouched.
- The `FIELDS` data and enum runtime values are bundled into the published JS;
  `Entity` types are type-only and erased at runtime.

The public API re-exports each module under its entity name:

```ts
// src/entities/index.ts (auto-generated)
export type { Entity as VehicleType, EntityLayout as VehicleTypeLayout } from './vehicleType';
export { FIELDS as vehicleTypeFields } from './vehicleType';
export type { Entity as Vehicle, EntityLayout as VehicleLayout } from './vehicle';
export { FIELDS as vehicleFields } from './vehicle';
```

### Ahead-of-backend patch overlay

`schema/sobek.patch.graphqls` is a committed SDL overlay that adds write-only
fields onto the read types before codegen runs:

```graphql
extend type VehicleType { dataOwnerRef: String }
extend type Vehicle { dataOwnerRef: String }
```

This satisfies the distill script's "Input ⊆ Entity" check (every field in
`VehicleTypeInput` must exist on `VehicleType`) so that `dataOwnerRef` is
included in `FIELDS`. The generated types are therefore deliberately **ahead of
the live read schema**. This is safe because the library executes no GraphQL
operations — it only generates types and renders a form. When sobek adds these
fields to its read types, delete the matching `extend` lines by hand.

## Building the library

`npm run build` uses [Vite's *library mode*](https://vite.dev/guide/build#library-mode).
Some terms, expanded for anyone new to library packaging:

- **ES module (`dist/index.js`)** — the modern JavaScript module format, loaded
  with `import`. This is what bundlers (Vite, webpack, etc.) prefer; it
  tree-shakes well (unused exports get dropped from the consumer's bundle).
- **CommonJS (`dist/index.cjs`)** — the older Node.js module format, loaded with
  `require`. Shipped alongside the ES module so the package works in
  older/Node-style toolchains too.
- **Type declarations (`dist/index.d.ts`)** — `.d.ts` files describe the types
  of the compiled JavaScript. They give consumers autocomplete and
  type-checking without shipping the TypeScript source. Generated here by
  [`vite-plugin-dts`](https://github.com/qmhc/vite-plugin-dts).
- **Externalised peer dependencies** — React, MUI, and Emotion are *not* bundled
  into `dist`. They are declared as **peer dependencies**: the consuming app is
  expected to already have them, and supplies its single shared copy. Bundling
  our own copies would bloat the output and, with React especially, cause
  subtle "two Reacts" bugs (hooks throwing, context not matching). The host
  app's copy is the only one in play.

The `package.json` `exports` map points each consumption style at the right
file: `import` → the ES module, `require` → the CommonJS file, `types` → the
declarations.

## Storybook & deployment

- `npm run storybook` — run Storybook locally on port 6006.
- `npm run build-storybook` — build the static Storybook to `storybook-static/`.
- CI (`.github/workflows/storybook.yml`) runs `distill` → `build-storybook` →
  deploy to **GitHub Pages** on every push to `main`. Enable Pages for the repo
  with the "GitHub Actions" source.

## Scripts

| Script | Does |
| --- | --- |
| `npm run codegen` | Download schema → generate `src/generated/sobekTypes.ts`. |
| `npm run distill` | Download schema → codegen → write `src/entities/*`. |
| `npm run build` | Library build to `dist/` (runs `distill` first). |
| `npm run storybook` | Local Storybook dev server (runs `distill` first). |
| `npm run build-storybook` | Static Storybook build (runs `distill` first). |
| `npm run test` | Vitest unit tests (runs `distill` first). |
| `npm run typecheck` | `tsc --noEmit` (runs `distill` first). |

## Versions

React 19, MUI 7, and Emotion 11 are pinned to match
[hathor](https://github.com/entur/hathor) (the primary consumer). They are peer
dependencies — the host app owns the actual versions.
