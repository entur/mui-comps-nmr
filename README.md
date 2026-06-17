# @entur/nmr-comps

A small React component library for Entur's **NMR** (Nasjonalt Materiellregister
— National Vehicle Registry). Components are built on [MUI](https://mui.com) and
typed directly from the live [sobek](https://github.com/entur/sobek) GraphQL
schema. Documented and previewed with [Storybook](https://storybook.js.org).

> Status: seed. One component so far — `VehicleTypeForm`. Not published to a
> package registry yet; the Storybook is deployed to GitHub Pages.

## Components

### `VehicleTypeForm`

A presentational editor for a NeTEx **VehicleType**, driven entirely by
`value` / `onChange` / `mode`. No data fetching, no save logic, no i18n runtime,
no router — drop it into any MUI app.

```tsx
import { useState } from 'react';
import { VehicleTypeForm, type VehicleType } from '@entur/nmr-comps';

function Example({ initial }: { initial: VehicleType }) {
  const [vt, setVt] = useState(initial);
  return <VehicleTypeForm value={vt} onChange={setVt} mode="edit" />;
}
```

| Prop | Type | Notes |
| --- | --- | --- |
| `value` | `VehicleType` | Current value (the codegen'd schema type — see below). |
| `onChange` | `(next: VehicleType) => void` | Fired with the merged value on every edit. |
| `mode` | `'view' \| 'edit'` | `'view'` disables all inputs. |
| `t?` | `(key: string, fallback: string) => string` | Optional translate fn; English fallbacks by default. |

#### Localisation without an i18n dependency

The library imports no i18n framework. Every label is requested through
`t(key, fallback)`; the default `t` just returns the English `fallback`. If your
app already uses `react-i18next` (or anything with a compatible `t`), pass it:

```tsx
import { useTranslation } from 'react-i18next';

const { t } = useTranslation();
<VehicleTypeForm value={vt} onChange={setVt} mode="edit" t={t} />;
```

## The GraphQL → TypeScript boundary

The library never hand-maintains the `VehicleType` shape. Instead it generates
TypeScript from the **live sobek schema** using
[The Guild's GraphQL Code Generator](https://the-guild.dev/graphql/codegen).

- **Canonical schema URL:** `https://entur.github.io/sobek/schema.graphqls`
- `npm run codegen` downloads that schema (`scripts/fetchSchema.ts`) and emits `src/generated/sobekTypes.ts`
  containing `VehicleType`, `PassengerCapacity`, `MultilingualString`, and the
  enums (`PropulsionType`, `FuelType`, `HybridCategory`, `TransportMode`).
- Enums are emitted as **runtime** TypeScript enums, so the form both
  type-checks against them and lists their members in dropdowns.
- The generated file and the downloaded schema are **git-ignored** — they are
  build artifacts, not source. Run `npm run codegen` once after cloning, before
  `dev`/`test`/`build` (the `build` and `storybook` scripts run it automatically
  via their `pre*` hooks).

### Read vs. write types

Sobek's schema exposes both `type VehicleType` (returned by reads) and
`input VehicleTypeInput` (the write payload) — a near-duplicate pair that is a
by-product of sobek's Java/GraphQL stack. They diverge in known ways (e.g.
`vehicles`/`version`/`created`/`changed`/`changedBy` are read-only;
`dataOwnerRef` is write-only). For now this library exposes **one** type,
`VehicleType`, and the form edits only the shared fields. Reconciling the
read/write split properly is deferred to a data-driven render in a later
iteration.

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
- CI (`.github/workflows/storybook.yml`) runs `codegen` → `build-storybook` →
  deploy to **GitHub Pages** on every push to `main`. Enable Pages for the repo
  with the "GitHub Actions" source.

## Scripts

| Script | Does |
| --- | --- |
| `npm run codegen` | Download schema → generate `src/generated/sobekTypes.ts`. |
| `npm run build` | Library build to `dist/` (runs `codegen` first). |
| `npm run storybook` | Local Storybook dev server (runs `codegen` first). |
| `npm run build-storybook` | Static Storybook build (runs `codegen` first). |
| `npm run test` | Vitest unit tests. |
| `npm run typecheck` | `tsc --noEmit`. |

## Versions

React 19, MUI 7, and Emotion 11 are pinned to match
[hathor](https://github.com/entur/hathor) (the primary consumer). They are peer
dependencies — the host app owns the actual versions.
