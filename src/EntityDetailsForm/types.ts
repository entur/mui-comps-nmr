/**
 * Public types for the generic, schema-driven entity form.
 *
 * `FieldSpec` is produced per field by `scripts/distillTypes.ts`; `Layout` is a
 * client-supplied whitelist of sections. See the design spec for the model.
 */
import type { FC } from 'react';

/** Control families the renderer knows how to draw. `grid` is a read-only table
 *  of an array-of-objects relation (always `serverManaged`); the rest are inputs. */
export type FieldKind = 'text' | 'number' | 'name' | 'switch' | 'enum' | 'enumMulti' | 'grid';

/** One field's runtime descriptor (generated into `FIELDS`). */
export interface FieldSpec {
  kind: FieldKind;
  /** Access path into the value (length 1 = top-level; >1 = flattened leaf). */
  path: readonly string[];
  /** Member list for `enum` / `enumMulti`. */
  options?: readonly string[];
  /** Backend owns this value (on Entity, not Input). Hidden from the editable
   *  model: rendered locked for viewing only, never merged into the write
   *  payload — not round-tripped. Stale after save (client refetches). */
  serverManaged?: boolean;
}

/** One field's placement within a section. `K` is the entity's flat field-key
 *  union (`EntityField` in the generated module); defaults loose for the factory. */
export interface FieldEntry<K extends string = string> {
  field: K;
  /** Override the humanized-default label (any language — localization is the client's job). */
  label?: string;
  /** **`grid` fields only** — explicit column order and labels. Each nested
   *  entry's `field` is a property key of the row object; its `label` overrides
   *  the humanized default. Columns render in this order; keys absent here are
   *  dropped. Omit to auto-derive every column from the row data. Ignored for
   *  non-grid fields. */
  entries?: FieldEntry[];
  [k: string]: unknown; // future per-field overrides (e.g. width)
}

/** A layout item is a bare field key or an entry object. */
export type LayoutItem<K extends string = string> = K | FieldEntry<K>;

/** Whitelist of sections: only listed fields render. Object-key order = section
 *  order; array order = field order within the section. A single section renders
 *  flat (label unused). */
export type Layout<K extends string = string> = Record<string, LayoutItem<K>[]>;

/** How ≥2 sections are presented: tab bar (one panel) or stacked panels. */
export type LayoutVariant = 'tabs' | 'stacked';

export interface EntityDetailsFormProps<E> {
  value: E;
  onChange: (next: E) => void;
  mode: 'view' | 'edit';
  /** Whitelist of sections. Omitted → flat, render all fields. */
  layout?: Layout;
  /** ≥2 sections render as tabs (default) or stacked panels. */
  variant?: LayoutVariant;
}

/** A factory-built form component. */
export type EntityDetailsForm<E> = FC<EntityDetailsFormProps<E>>;
