/**
 * Public types for the generic, schema-driven entity form.
 *
 * `FieldSpec` is produced per field by `scripts/distillTypes.ts`; `Layout` is a
 * client-supplied whitelist of sections. See the design spec for the model.
 */
import type { FC } from 'react';
import type { AutocompleteProps, SwitchProps, TextFieldProps } from '@mui/material';
import type { DataGridProps } from '@mui/x-data-grid';

/** Control families the renderer knows how to draw. `grid` is a read-only table
 *  of an array-of-objects relation (always `serverManaged`); `reference` edits a
 *  single relation by its identity leaf (Autocomplete when the layout supplies
 *  `options`, else a free-text id field); `date`/`datetime` are native pickers;
 *  the rest are plain inputs. */
export type FieldKind =
  | 'text'
  | 'number'
  | 'name'
  | 'switch'
  | 'enum'
  | 'enumMulti'
  | 'grid'
  | 'reference'
  | 'date'
  | 'datetime';

/** One selectable option for a `reference` field's Autocomplete. `value` is the
 *  referenced entity's identity (written into the field's id leaf); `label` is
 *  display-only. */
export interface RefOption {
  value: string;
  label: string;
}

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
  /** **`reference` fields only** — supplies the Autocomplete's candidate dataset.
   *  A closure (capturing the client's data) returning `{ value, label }[]`;
   *  `value` is the referenced entity's id. Omit → the field degrades to a
   *  free-text id input. Ignored for non-reference fields. */
  options?: () => RefOption[];
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

/** Form-level MUI overrides, keyed by control kind. Applies to *every* field of
 *  that kind. The TextField-backed kinds (`text` / `number` / `name` / `enum`)
 *  take the TextField `slotProps` (merged over the lib's label-shrink default);
 *  the rest take the natural target for their root MUI component.
 *
 *  NOTE (future): per-field overrides are not yet wired. The intended next step
 *  is a `slotProps` key on `FieldEntry` (it already carries an open index
 *  signature) that wins over these per-kind defaults. */
export interface ControlSlotProps {
  text?: TextFieldProps['slotProps'];
  number?: TextFieldProps['slotProps'];
  name?: TextFieldProps['slotProps'];
  enum?: TextFieldProps['slotProps'];
  /** `date` / `datetime` are native-input TextFields. */
  date?: TextFieldProps['slotProps'];
  datetime?: TextFieldProps['slotProps'];
  /** Multi-select renders an `Autocomplete`. */
  enumMulti?: AutocompleteProps<string, true, false, false>['slotProps'];
  /** Spread onto the `<Switch>` (the controlled `checked`/`onChange` always win). */
  switch?: SwitchProps;
  /** Passthrough to the read-only grid's underlying MUI X `DataGrid`. */
  grid?: { dataGrid?: Partial<DataGridProps> };
}

export interface EntityDetailsFormProps<E> {
  value: E;
  onChange: (next: E) => void;
  mode: 'view' | 'edit';
  /** Whitelist of sections. Omitted → flat, render all fields. */
  layout?: Layout;
  /** ≥2 sections render as tabs (default) or stacked panels. */
  variant?: LayoutVariant;
  /** Per-kind MUI overrides (see `ControlSlotProps`). Applies to every field of
   *  the given kind; per-field overrides are a planned later addition. */
  slotProps?: ControlSlotProps;
}

/** A factory-built form component. */
export type EntityDetailsForm<E> = FC<EntityDetailsFormProps<E>>;
