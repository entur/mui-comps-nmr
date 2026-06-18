import type { ReactNode } from 'react';
import { Autocomplete, FormControlLabel, MenuItem, Switch, TextField } from '@mui/material';
import type { FieldEntry, FieldSpec } from './types';
import { ObjectGrid } from './ObjectGrid';

/** A MultilingualString-ish shape: only `.value` is edited; `.lang` is preserved. */
type Mls = { lang?: string | null; value?: string | null } | null | undefined;

/** Pin the input label above the field even when empty, so rows align whether
 *  or not a field carries a value (MUI otherwise rests it inside until populated). */
const SHRINK_LABEL = { inputLabel: { shrink: true } } as const;

const numVal = (n: unknown): number | '' => (n == null ? '' : (n as number));
const numOr = (s: string): number | undefined => (s === '' ? undefined : Number(s));
const textOr = (s: string): string | undefined => (s === '' ? undefined : s);
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
}: ControlProps): ReactNode {
  const common = {
    label,
    disabled,
    size: 'small' as const,
    fullWidth: true,
    slotProps: SHRINK_LABEL,
  };

  switch (spec.kind) {
    case 'number':
      return (
        <TextField
          {...common}
          type="number"
          value={numVal(value)}
          onChange={e => onChange(numOr(e.target.value))}
        />
      );

    case 'text':
      return (
        <TextField
          {...common}
          value={(value as string | null | undefined) ?? ''}
          onChange={e => onChange(textOr(e.target.value))}
        />
      );

    case 'name':
      return (
        <TextField
          {...common}
          value={(value as Mls)?.value ?? ''}
          onChange={e => onChange(mergeName(value as Mls, e.target.value))}
        />
      );

    case 'switch':
      return (
        <FormControlLabel
          control={
            <Switch
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
          renderInput={params => <TextField {...params} label={label} slotProps={SHRINK_LABEL} />}
        />
      );

    case 'grid':
      // Read-only relation table. `disabled`/`onChange` don't apply — grids are
      // always serverManaged. `value` is the relation array at the field's path.
      // Show the label only when sharing the section with other fields.
      return <ObjectGrid rows={value} label={label} showLabel={!solo} cols={cols} />;

    default:
      return null;
  }
}
