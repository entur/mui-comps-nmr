/**
 * `renderControl` in labelless mode. Two things must hold for every kind: the
 * control draws no label of its own (or the row's label would appear twice),
 * and its input carries `controlId` (or the row's `<label htmlFor>` binds to
 * nothing and the control loses its accessible name).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { renderControl } from './controls';
import type { FieldSpec } from '../types';

const draw = (spec: FieldSpec, extra: Partial<Parameters<typeof renderControl>[0]> = {}) =>
  render(
    <>
      {renderControl({
        spec,
        label: 'Registration number',
        value: undefined,
        disabled: false,
        onChange: () => {},
        ...extra,
      })}
    </>
  );

const TEXT: FieldSpec = { kind: 'text', path: ['registrationNumber'] };
const SWITCH: FieldSpec = { kind: 'switch', path: ['lowFloor'] };
const MULTI: FieldSpec = { kind: 'enumMulti', path: ['fuelTypes'], options: ['diesel'] };

describe('renderControl', () => {
  it('still draws its own label by default, so the float path is unchanged', () => {
    draw(TEXT);
    expect(screen.getByLabelText('Registration number')).toBeInTheDocument();
  });

  it('draws no label when labelless — the row owns it', () => {
    const { container } = draw(TEXT, { labelless: true, controlId: 'f1' });
    expect(container.querySelector('label')).toBeNull();
  });

  it('puts controlId on a text input, so htmlFor has a target', () => {
    draw(TEXT, { labelless: true, controlId: 'f1' });
    expect(screen.getByRole('textbox').id).toBe('f1');
  });

  it('puts controlId on the switch input and drops FormControlLabel', () => {
    // FormControlLabel would render a second copy of the label to the right of
    // the toggle — the one kind whose label placement genuinely changes here.
    const { container } = draw(SWITCH, { labelless: true, controlId: 'f1' });
    expect(container.querySelector('label')).toBeNull();
    // MUI v7's Switch input carries role="switch" (not "checkbox").
    expect(screen.getByRole('switch').id).toBe('f1');
  });

  it('puts controlId on the Autocomplete input for enumMulti', () => {
    // MUI forwards Autocomplete's `id` to the inner input, so htmlFor works
    // here too — no aria-labelledby needed.
    const { container } = draw(MULTI, { labelless: true, controlId: 'f1' });
    expect(container.querySelector('label')).toBeNull();
    expect(screen.getByRole('combobox').id).toBe('f1');
  });
});
