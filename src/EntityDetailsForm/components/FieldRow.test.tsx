/**
 * `FieldRow` is the only place that knows how a label is placed. These pin both
 * branches: `'float'` must reproduce the original markup (no label of its own —
 * the MUI control draws it), `'start'` must emit a real `<label htmlFor>` as a
 * *sibling* of the control so both land as items of the section's grid.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FieldRow, ROW_GRID_SX, FORM_CONTAINER_SX } from './FieldRow';

describe('FieldRow', () => {
  it('draws no label of its own in float mode — the control owns it', () => {
    const { container } = render(
      <FieldRow id="f1" label="Registration number" placement="float">
        <input id="f1" />
      </FieldRow>
    );

    expect(container.querySelector('label')).toBeNull();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('binds a real label to the control in start mode', () => {
    render(
      <FieldRow id="f1" label="Registration number" placement="start">
        <input id="f1" />
      </FieldRow>
    );

    // Resolves only if `htmlFor` actually reaches the control's id — the whole
    // accessibility risk of moving the label out of the MUI component.
    expect(screen.getByLabelText('Registration number')).toBe(screen.getByRole('textbox'));
  });

  it('emits label and control as siblings, so the grid can lay them out', () => {
    const { container } = render(
      <FieldRow id="f1" label="Registration number" placement="start">
        <input id="f1" />
      </FieldRow>
    );

    // A wrapper around the pair would make the row a single grid item and the
    // two columns would never form.
    const label = container.querySelector('label');
    expect(label?.nextElementSibling?.tagName).toBe('INPUT');
  });

  it('draws the label as a non-<label> element with no htmlFor when labelable is false', () => {
    // `grid` fields render a data table, not a single control — there is no id
    // to point a `<label htmlFor>` at, so `labelable={false}` (set by
    // `abstractForm` for `kind: 'grid'`) keeps the label visible without
    // emitting a `<label>` that would dangle.
    const { container } = render(
      <FieldRow id="f1" label="Fleet" placement="start" labelable={false}>
        <div role="grid" aria-label="Fleet" />
      </FieldRow>
    );

    expect(container.querySelector('label')).toBeNull();
    expect(screen.getByText('Fleet').tagName).toBe('SPAN');
  });

  it('puts labelId on the label element, so a non-labelable control can point back', () => {
    // The route `enum` depends on: MUI's Select renders `div[role=combobox]`,
    // which `<label htmlFor>` cannot name, so `abstractForm` passes the label's
    // own id to the control for `aria-labelledby` instead.
    render(
      <FieldRow
        id="f1"
        labelId="f1-label"
        label="Hybrid category"
        placement="start"
        labelable={false}
      >
        <div role="combobox" id="f1" aria-labelledby="f1-label" />
      </FieldRow>
    );

    expect(screen.getByText('Hybrid category').id).toBe('f1-label');
    expect(screen.getByLabelText('Hybrid category')).toBe(screen.getByRole('combobox'));
  });

  it('scopes the collapse to the form’s own width, not the viewport', () => {
    // A narrow drawer on a wide monitor must collapse too, so the query has to
    // be a @container rule and the container-type must sit on a *different*
    // element — an element’s own @container rule resolves against an ancestor.
    expect(JSON.stringify(ROW_GRID_SX)).toContain('@container');
    expect(JSON.stringify(ROW_GRID_SX)).not.toContain('containerType');
    expect(FORM_CONTAINER_SX).toEqual({ containerType: 'inline-size' });
    // NOTE: that FORM_CONTAINER_SX stays *spreadable* is enforced by `tsc`, not
    // here — callers merge it into a larger sx, which the SxProps union (arrays,
    // functions) forbids. A runtime `expect({ ...X }).toEqual(X)` would pass
    // whatever the type said, so it is deliberately not written.
  });
});
