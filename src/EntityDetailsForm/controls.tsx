import type { ReactNode } from 'react';
import { Autocomplete, FormControlLabel, MenuItem, Switch, TextField } from '@mui/material';
import type { TextFieldProps } from '@mui/material';
import type { ControlSlotProps, FieldEntry, FieldSpec, RefOption } from './types';
import { ObjectGrid } from './ObjectGrid';

/** A MultilingualString-ish shape: only `.value` is edited; `.lang` is preserved. */
type Mls = { lang?: string | null; value?: string | null } | null | undefined;

/** Pin the input label above the field even when empty, so rows align whether
 *  or not a field carries a value (MUI otherwise rests it inside until populated). */
const SHRINK_LABEL = { inputLabel: { shrink: true } } as const;

/** Merge consumer TextField `slotProps` over `SHRINK_LABEL`, one slot-key deep so
 *  `inputLabel.shrink` survives unless the consumer explicitly overrides it. */
const mergeSlots = (extra?: TextFieldProps['slotProps']): TextFieldProps['slotProps'] =>
  !extra
    ? SHRINK_LABEL
    : { ...extra, inputLabel: { ...SHRINK_LABEL.inputLabel, ...extra.inputLabel } };

const numVal = (n: unknown): number | '' => (n == null ? '' : (n as number));
const numOr = (s: string): number | undefined => (s === '' ? undefined : Number(s));
const textOr = (s: string): string | undefined => (s === '' ? undefined : s);
/** Slice a stored ISO string down to a native date input's value format:
 *  `date` → `YYYY-MM-DD` (10 chars), `datetime-local` → `YYYY-MM-DDTHH:mm` (16). */
const isoSlice = (v: unknown, len: number): string => (typeof v === 'string' ? v.slice(0, len) : '');
const mergeName = (cur: Mls, text: string): Mls =>
  text === '' ? undefined : { ...cur, value: text };

export interface ControlProps {
  spec: FieldSpec;
  label: string;
  value: unknown;
  disabled: boolean;
  /** Emit the next raw value for this field's path (`undefined` clears it). */
  onChange: (next: unknown) => void;
  /** True when this field is the only one in its section. A `grid` then omits
   *  its own label (the section tab/heading already names it); ignored by the
   *  scalar controls, which always carry their own label. */
  solo?: boolean;
  /** `grid` only — explicit column order/labels (the layout entry's `entries`).
   *  Omit → columns auto-derived from row data. */
  cols?: FieldEntry[];
  /** `reference` only — option-dataset closure (the layout entry's `options`).
   *  Present → render an Autocomplete; omit → degrade to a free-text id field. */
  options?: () => RefOption[];
  /** Form-level per-kind MUI overrides. The slice for this field's `spec.kind`
   *  is applied to its control (see `ControlSlotProps`). */
  slotProps?: ControlSlotProps;
}

/**
 * Render the MUI control for one field, dispatched by `spec.kind`. Read-only
 * (`disabled`) when the form is in view mode or the field is `serverManaged`.
 *
 * @param spec     Field descriptor (kind, options).
 * @param label    Resolved label (override or humanized default).
 * @param value    Raw value at the field's path.
 * @param disabled Whether the control is locked.
 * @param onChange Receives the next raw value.
 * @returns The control node.
 */
export function renderControl({
  spec,
  label,
  value,
  disabled,
  onChange,
  solo,
  cols,
  options,
  slotProps,
}: ControlProps): ReactNode {
  // Shared TextField props. `slotProps` is set per-kind below (each TextField
  // kind merges its own override over `SHRINK_LABEL`); the bare default keeps
  // the label shrunk when no override is supplied.
  const common = {
    label,
    disabled,
    size: 'small' as const,
    fullWidth: true,
    slotProps: SHRINK_LABEL as TextFieldProps['slotProps'],
  };

  switch (spec.kind) {
    case 'number':
      return (
        <TextField
          {...common}
          slotProps={mergeSlots(slotProps?.number)}
          type="number"
          value={numVal(value)}
          onChange={e => onChange(numOr(e.target.value))}
        />
      );

    case 'text':
      return (
        <TextField
          {...common}
          slotProps={mergeSlots(slotProps?.text)}
          value={(value as string | null | undefined) ?? ''}
          onChange={e => onChange(textOr(e.target.value))}
        />
      );

    case 'date':
      return (
        <TextField
          {...common}
          slotProps={mergeSlots(slotProps?.date)}
          type="date"
          value={isoSlice(value, 10)}
          onChange={e => onChange(textOr(e.target.value))}
        />
      );

    case 'datetime':
      // Native datetime-local: the stored ISO (tz/seconds) is sliced to the
      // input's `YYYY-MM-DDTHH:mm`. Lossy on write — fine, datetime fields here
      // are all serverManaged (display-only, never round-tripped).
      return (
        <TextField
          {...common}
          slotProps={mergeSlots(slotProps?.datetime)}
          type="datetime-local"
          value={isoSlice(value, 16)}
          onChange={e => onChange(textOr(e.target.value))}
        />
      );

    case 'name':
      return (
        <TextField
          {...common}
          slotProps={mergeSlots(slotProps?.name)}
          value={(value as Mls)?.value ?? ''}
          onChange={e => onChange(mergeName(value as Mls, e.target.value))}
        />
      );

    case 'switch':
      return (
        <FormControlLabel
          control={
            // Consumer Switch props spread first so the controlled
            // `checked`/`disabled`/`onChange` below always win.
            <Switch
              {...slotProps?.switch}
              checked={!!value}
              disabled={disabled}
              onChange={e => onChange(e.target.checked)}
            />
          }
          label={label}
        />
      );

    case 'enum':
      return (
        <TextField
          {...common}
          slotProps={mergeSlots(slotProps?.enum)}
          select
          value={(value as string | null | undefined) ?? ''}
          onChange={e => onChange(e.target.value || undefined)}
        >
          <MenuItem value="">
            <em>None</em>
          </MenuItem>
          {(spec.options ?? []).map(o => (
            <MenuItem key={o} value={o}>
              {o}
            </MenuItem>
          ))}
        </TextField>
      );

    case 'enumMulti':
      return (
        <Autocomplete
          multiple
          size="small"
          disabled={disabled}
          options={[...(spec.options ?? [])]}
          value={((value as string[] | null | undefined) ?? []).filter(Boolean)}
          onChange={(_e, v) => onChange(v.length ? v : undefined)}
          slotProps={slotProps?.enumMulti}
          renderInput={params => <TextField {...params} label={label} slotProps={SHRINK_LABEL} />}
        />
      );

    case 'reference': {
      // Single relation edited by its identity leaf (`path` ends at the id).
      // With a `options` dataset → Autocomplete; without → free-text id field
      // (zero-config forms carry no layout entry, so they always degrade).
      const opts = options?.();
      if (!opts)
        return (
          <TextField
            {...common}
            value={(value as string | null | undefined) ?? ''}
            onChange={e => onChange(textOr(e.target.value))}
          />
        );
      const selected = opts.find(o => o.value === value) ?? null;
      return (
        <Autocomplete
          size="small"
          disabled={disabled}
          options={opts}
          getOptionLabel={o => o.label}
          isOptionEqualToValue={(o, v) => o.value === v.value}
          value={selected}
          onChange={(_e, o) => onChange(o ? o.value : undefined)}
          renderInput={params => <TextField {...params} label={label} slotProps={SHRINK_LABEL} />}
        />
      );
    }

    case 'grid':
      // Read-only relation table. `disabled`/`onChange` don't apply — grids are
      // always serverManaged. `value` is the relation array at the field's path.
      // Show the label only when sharing the section with other fields.
      return (
        <ObjectGrid
          rows={value}
          label={label}
          showLabel={!solo}
          cols={cols}
          dataGrid={slotProps?.grid?.dataGrid}
        />
      );

    default:
      return null;
  }
}
