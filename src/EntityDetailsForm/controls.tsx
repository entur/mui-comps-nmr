import type { ReactNode } from 'react';
import { Autocomplete, FormControlLabel, MenuItem, Switch, TextField } from '@mui/material';
import type { FieldSpec } from './types';

/** A MultilingualString-ish shape: only `.value` is edited; `.lang` is preserved. */
type Mls = { lang?: string | null; value?: string | null } | null | undefined;

const numVal = (n: unknown): number | '' => (n == null ? '' : (n as number));
const numOr = (s: string): number | undefined => (s === '' ? undefined : Number(s));
const textOr = (s: string): string | undefined => (s === '' ? undefined : s);
const mergeName = (cur: Mls, text: string): Mls => (text === '' ? undefined : { ...cur, value: text });

export interface ControlProps {
  spec: FieldSpec;
  label: string;
  value: unknown;
  disabled: boolean;
  /** Emit the next raw value for this field's path (`undefined` clears it). */
  onChange: (next: unknown) => void;
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
export function renderControl({ spec, label, value, disabled, onChange }: ControlProps): ReactNode {
  const common = { label, disabled, size: 'small' as const, fullWidth: true };

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
            <Switch checked={!!value} disabled={disabled} onChange={e => onChange(e.target.checked)} />
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
          renderInput={params => <TextField {...params} label={label} />}
        />
      );

    default:
      return null;
  }
}
