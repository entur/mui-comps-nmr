/**
 * `renderControl` in labelless mode. Two things must hold for **every** kind:
 * the control draws no label of its own (or the row's label would appear twice),
 * and it is still reachable by that label's text — the central claim of
 * two-column mode is that moving the label out of the MUI control never costs
 * the control its accessible name.
 *
 * Both are asserted from one table rather than a case per kind, so a new
 * `FieldKind` cannot ship without coverage. `grid` is the one exemption: it is
 * not drawn by `renderControl` at all (`abstractForm` routes it to `ObjectGrid`,
 * which is a data table with no labelable input and supplies its own
 * `aria-label`).
 *
 * The naming half renders the real `FieldRow` beside the control, because the
 * binding is a property of the *pair*: most kinds are named by `htmlFor` →
 * `controlId`, but `enum` renders a non-labelable `div[role=combobox]` and has
 * to point back at the label element with `aria-labelledby`.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderControl, type ControlProps } from './controls';
import { FieldRow } from './FieldRow';
import type { FieldKind, FieldSpec } from '../types';

const LABEL = 'Registration number';
const CONTROL_ID = 'f1', LABEL_ID = 'f1-label';

const draw = (spec: FieldSpec, extra: Partial<ControlProps> = {}) =>
  render(
    <>
      {renderControl({
        spec,
        label: LABEL,
        value: undefined,
        disabled: false,
        onChange: () => {},
        ...extra,
      })}
    </>
  );

const TEXT: FieldSpec = { kind: 'text', path: ['registrationNumber'] };

/** One kind under test: how to spec it, whether its control is labelable (the
 *  same call `abstractForm` makes), and what the label must resolve to. */
interface Case {
  /** Distinguishes the two `reference` branches, which share a `kind`. */
  name: string;
  spec: FieldSpec;
  /** Extra `renderControl` input this kind needs (only `reference`'s options). */
  extra?: Partial<ControlProps>;
  /** `false` where the control is not a single labelable element, so the row
   *  emits a `<span id>` for `aria-labelledby` instead of a `<label for>`. */
  labelable?: boolean;
  /** Assert the element the label resolved to really is this kind's control. */
  check: (el: HTMLElement) => void;
}

const isInput = (type: string) => (el: HTMLElement) => {
  expect(el.tagName).toBe('INPUT');
  expect((el as HTMLInputElement).type).toBe(type);
  expect(el.id).toBe(CONTROL_ID);
};

/** Autocomplete and Select both expose `role="combobox"`; only the element it
 *  lands on differs (an `<input>` vs the Select's `<div>`). */
const isCombobox = (tag: string) => (el: HTMLElement) => {
  expect(el.tagName).toBe(tag);
  expect(el).toHaveAttribute('role', 'combobox');
  expect(el.id).toBe(CONTROL_ID);
};

const CASES: Case[] = [
  { name: 'text', spec: TEXT, check: isInput('text') },
  { name: 'number', spec: { kind: 'number', path: ['length'] }, check: isInput('number') },
  { name: 'name', spec: { kind: 'name', path: ['name'] }, check: isInput('text') },
  {
    // The regression this table exists for: a `TextField select` renders
    // `div[role=combobox]`, which `<label for>` cannot name — the association
    // is discarded, and MUI's own aria-labelledby fallback collapses to the
    // combobox pointing at itself once `label` is undefined.
    name: 'enum',
    spec: { kind: 'enum', path: ['hybridCategory'], options: ['diesel', 'electric'] },
    labelable: false,
    check: isCombobox('DIV'),
  },
  { name: 'date', spec: { kind: 'date', path: ['built'] }, check: isInput('date') },
  {
    name: 'datetime',
    spec: { kind: 'datetime', path: ['changed'] },
    check: isInput('datetime-local'),
  },
  {
    // MUI v7's Switch input carries role="switch" (not "checkbox"), and the
    // labelless branch drops FormControlLabel so the toggle is bare.
    name: 'switch',
    spec: { kind: 'switch', path: ['lowFloor'] },
    check: el => {
      expect(el).toHaveAttribute('role', 'switch');
      expect(el.id).toBe(CONTROL_ID);
    },
  },
  {
    // MUI forwards Autocomplete's `id` to the inner input, so `htmlFor` reaches
    // a real labelable element here — no aria-labelledby needed.
    name: 'enumMulti',
    spec: { kind: 'enumMulti', path: ['fuelTypes'], options: ['diesel'] },
    check: isCombobox('INPUT'),
  },
  {
    // Both `reference` branches: no `options` closure degrades to free text.
    name: 'reference (no options → free text)',
    spec: { kind: 'reference', path: ['transportType', 'netexId'] },
    check: isInput('text'),
  },
  {
    name: 'reference (options → Autocomplete)',
    spec: { kind: 'reference', path: ['transportType', 'netexId'] },
    extra: { options: () => [{ value: 'VT:1', label: 'Class 70 EMU' }] },
    check: isCombobox('INPUT'),
  },
];

/** Every kind `renderControl` draws. Typed as a `Record`, so adding a
 *  `FieldKind` fails `tsc` here — and the coverage test below then fails until
 *  the table above actually carries a row for it. `grid` never reaches
 *  `renderControl`, so it is excluded by the type. */
const DRAWN_KINDS: Record<Exclude<FieldKind, 'grid'>, true> = {
  text: true,
  number: true,
  name: true,
  enum: true,
  date: true,
  datetime: true,
  switch: true,
  enumMulti: true,
  reference: true,
};

describe('renderControl', () => {
  it('covers every kind renderControl draws', () => {
    const covered = [...new Set(CASES.map(c => c.spec.kind))].sort();
    expect(covered).toEqual(Object.keys(DRAWN_KINDS).sort());
  });

  it('still draws its own label by default, so the float path is unchanged', () => {
    draw(TEXT);
    expect(screen.getByLabelText(LABEL)).toBeInTheDocument();
  });

  describe.each(CASES)('kind: $name', ({ spec, extra, labelable = true, check }) => {
    it('keeps the control reachable by the row’s label', () => {
      render(
        <FieldRow
          id={CONTROL_ID}
          labelId={LABEL_ID}
          label={LABEL}
          placement="start"
          labelable={labelable}
        >
          {renderControl({
            spec,
            label: LABEL,
            value: undefined,
            disabled: false,
            onChange: () => {},
            controlId: CONTROL_ID,
            labelId: LABEL_ID,
            labelless: true,
            ...extra,
          })}
        </FieldRow>
      );

      check(screen.getByLabelText(LABEL));
    });

    it('draws no label of its own — the row owns it', () => {
      const { container } = draw(spec, {
        ...extra,
        labelless: true,
        controlId: CONTROL_ID,
        labelId: LABEL_ID,
      });

      expect(container.querySelector('label')).toBeNull();
      expect(container.querySelector('.MuiInputLabel-root')).toBeNull();
    });
  });
});
