import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createAbstractEntityDetailsForm } from './abstractForm';
import type { FieldSpec, EntityDetailsFormProps } from '../types';

interface V {
  name?: { value?: string | null } | null;
  length?: number | null;
  version?: number | null;
  dataOwnerRef?: string | null;
  vehicles?: { netexId?: string | null; name?: string | null }[] | null;
}

const fields: Record<string, FieldSpec> = {
  name: { kind: 'name', path: ['name'] },
  length: { kind: 'number', path: ['length'] },
  version: { kind: 'number', path: ['version'], serverManaged: true },
  dataOwnerRef: { kind: 'text', path: ['dataOwnerRef'], locked: true },
  vehicles: { kind: 'grid', path: ['vehicles'], serverManaged: true },
};

// `grid` is the one kind that isn't a single labelable control (see
// `FieldRow`'s `labelable`) — several assertions below need "how many fields
// actually get a real `<label>`", which is this count, not `fields`' size.
const labelableFieldCount = Object.values(fields).filter(f => f.kind !== 'grid').length;

const Form = createAbstractEntityDetailsForm<V>(fields);

const Host = (props: Partial<EntityDetailsFormProps<V>>) => {
  const [v, setV] = useState<V>({
    name: { value: 'Tram' },
    length: 5,
    version: 1,
    dataOwnerRef: 'NOG:Authority:test',
    vehicles: [{ netexId: 'NSB:Vehicle:1', name: 'Wagon 1' }],
  });
  return <Form value={v} onChange={setV} mode="edit" {...props} />;
};

describe('createAbstractEntityDetailsForm', () => {
  it('renders all fields flat when no layout is given', () => {
    render(<Host />);
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Tram');
    expect((screen.getByLabelText('Length') as HTMLInputElement).value).toBe('5');
  });

  it('round-trips a name edit through onChange', () => {
    render(<Host />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bus' } });
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Bus');
  });

  it('locks serverManaged fields even in edit mode', () => {
    render(<Host />);
    expect(screen.getByLabelText('Version')).toBeDisabled();
  });

  it('locks locked fields even in edit mode', () => {
    render(<Host />);
    const input = screen.getByLabelText('Data owner ref') as HTMLInputElement;
    expect(input).toBeDisabled();
    expect(input.value).toBe('NOG:Authority:test');
  });

  it('disables every field in view mode', () => {
    render(<Host mode="view" />);
    expect(screen.getByLabelText('Name')).toBeDisabled();
    expect(screen.getByLabelText('Length')).toBeDisabled();
  });

  it('whitelists: a field absent from the layout is not rendered', () => {
    render(<Host layout={{ Edit: ['name'] }} />);
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.queryByLabelText('Length')).toBeNull();
  });

  it('honors a label override', () => {
    render(<Host layout={{ Edit: [{ field: 'length', label: 'Length (m)' }] }} />);
    expect(screen.getByLabelText('Length (m)')).toBeInTheDocument();
  });

  it('renders a tab bar only with ≥2 sections', () => {
    render(<Host layout={{ A: ['name'], B: ['length'] }} />);
    expect(screen.getByRole('tab', { name: 'A' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'B' })).toBeInTheDocument();
  });

  it('stacks sections with no tab bar when variant="stacked"', () => {
    render(<Host layout={{ A: ['name'], B: ['length'] }} variant="stacked" />);
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Length')).toBeInTheDocument();
  });

  it('drops a section whose keys are all unknown (no empty tab)', () => {
    render(<Host layout={{ Real: ['name'], Ghost: ['nope'] }} />);
    expect(screen.queryByRole('tab')).toBeNull(); // only one non-empty section → flat
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('applies a per-kind TextField slotProps override and keeps the shrink default', () => {
    // `name` is a `name` kind (TextField). The override sets a slot prop but
    // omits `inputLabel`, so the lib's label-shrink default must survive.
    const { container } = render(<Host slotProps={{ name: { htmlInput: { maxLength: 80 } } }} />);
    expect(screen.getByLabelText('Name')).toHaveAttribute('maxlength', '80');
    expect(container.querySelector('label')).toHaveClass('MuiInputLabel-shrink');
  });

  it('spreads per-kind switch slotProps onto the Switch', () => {
    const SwForm = createAbstractEntityDetailsForm<{ active?: boolean }>({
      active: { kind: 'switch', path: ['active'] },
    });
    const { container } = render(
      <SwForm
        value={{ active: true }}
        onChange={() => {}}
        mode="edit"
        slotProps={{ switch: { color: 'secondary' } }}
      />
    );
    expect(container.querySelector('.MuiSwitch-colorSecondary')).not.toBeNull();
  });

  it('renders a date kind as a native date input', () => {
    const DForm = createAbstractEntityDetailsForm<{ built?: string | null }>({
      built: { kind: 'date', path: ['built'] },
    });
    render(<DForm value={{ built: '2020-01-15' }} onChange={() => {}} mode="edit" />);
    const input = screen.getByLabelText('Built') as HTMLInputElement;
    expect(input.type).toBe('date');
    expect(input.value).toBe('2020-01-15');
  });

  interface R {
    transportType?: { netexId?: string | null } | null;
  }
  const refFields: Record<string, FieldSpec> = {
    transportType: { kind: 'reference', path: ['transportType', 'netexId'] },
  };
  const RefForm = createAbstractEntityDetailsForm<R>(refFields);

  it('reference with options renders an Autocomplete showing the matched label', () => {
    const layout = {
      Edit: [
        {
          field: 'transportType',
          label: 'VehicleType',
          options: () => [
            { value: 'VT:1', label: 'Class 70 EMU' },
            { value: 'VT:2', label: 'Class 80 DMU' },
          ],
        },
      ],
    };
    render(
      <RefForm
        value={{ transportType: { netexId: 'VT:2' } }}
        onChange={() => {}}
        mode="edit"
        layout={layout}
      />
    );
    // The combobox shows the label of the option whose value matches the id leaf.
    expect((screen.getByLabelText('VehicleType') as HTMLInputElement).value).toBe('Class 80 DMU');
  });

  it('reference without options degrades to a free-text id field', () => {
    // No layout → no `options` closure; the field edits the raw netexId leaf.
    render(<RefForm value={{ transportType: { netexId: 'VT:9' } }} onChange={() => {}} mode="edit" />);
    const input = screen.getByLabelText('Transport type') as HTMLInputElement;
    expect(input.value).toBe('VT:9');
    expect(input).not.toHaveAttribute('role', 'combobox');
  });

  it('reference Autocomplete writes the selected value into the id leaf', () => {
    const Host2 = () => {
      const [v, setV] = useState<R>({ transportType: { netexId: 'VT:1' } });
      return (
        <RefForm
          value={v}
          onChange={setV}
          mode="edit"
          layout={{
            Edit: [
              {
                field: 'transportType',
                options: () => [
                  { value: 'VT:1', label: 'Alpha' },
                  { value: 'VT:2', label: 'Beta' },
                ],
              },
            ],
          }}
        />
      );
    };
    render(<Host2 />);
    const input = screen.getByLabelText('Transport type') as HTMLInputElement;
    fireEvent.mouseDown(input); // open the listbox
    fireEvent.click(screen.getByText('Beta'));
    expect(input.value).toBe('Beta');
  });

  it('surfaces errors and disables inputs when disabled is true', () => {
    const { container } = render(
      <Form
        value={{ name: { value: 'Tram' }, length: 5 }}
        onChange={() => {}}
        mode="edit"
        errors={{ name: 'Already exists' }}
        disabled
      />
    );
    const nameInput = screen.getByLabelText('Name') as HTMLInputElement;
    expect(nameInput).toBeDisabled();
    expect(container.querySelector('.Mui-error')).not.toBeNull();
    expect(screen.getByText(/Already exists/)).toBeInTheDocument();
  });
});

/**
 * The central guarantee of two-column mode: moving the label out of the MUI
 * control must not cost the control its accessible name. Asserted with the
 * *same* queries in both placements — if `start` broke the binding, the shared
 * cases below would fail only for `start`.
 */
describe.each(['float', 'start'] as const)('labelPlacement=%s', placement => {
  it('keeps every control reachable by its label', () => {
    render(<Host labelPlacement={placement} />);
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Tram');
    expect((screen.getByLabelText('Length') as HTMLInputElement).value).toBe('5');
  });

  it('round-trips an edit', () => {
    render(<Host labelPlacement={placement} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bus' } });
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Bus');
  });

  it('still locks serverManaged and locked fields', () => {
    render(<Host labelPlacement={placement} />);
    expect(screen.getByLabelText('Version')).toBeDisabled();
    expect(screen.getByLabelText('Data owner ref')).toBeDisabled();
  });
});

describe('labelPlacement=start', () => {
  it('gives each field exactly one label element', () => {
    const { container } = render(<Host labelPlacement="start" />);
    // Two would mean the control kept drawing its own beside the row's. The
    // `grid` field is excluded from the count: it gets a visible label too,
    // but not a `<label>` element (see `labelableFieldCount` above and the
    // dedicated grid case below) — ObjectGrid exposes no id for a real
    // `<label htmlFor>` to bind to, so a `<label>` there would dangle.
    expect(container.querySelectorAll('label')).toHaveLength(labelableFieldCount);
  });

  it('draws no MUI floating label — the row owns the label instead', () => {
    const { container } = render(<Host labelPlacement="start" />);
    expect(container.querySelector('.MuiInputLabel-root')).toBeNull();
  });

  it('leaves the float markup alone by default', () => {
    const { container } = render(<Host />);
    // Every non-grid field in this fixture is TextField-backed, so the
    // default path must still produce one MUI floating label each. `grid`
    // never renders a `.MuiInputLabel-root` (it's not a TextField), in either
    // placement, so it's excluded here too.
    // NB: do NOT assert on `[class*="MuiFormLabel-root"][for]` here — the
    // control now always carries `controlId`, so MUI's own InputLabel gains a
    // `for` attribute in float mode too and such an assertion would fail.
    expect(container.querySelectorAll('.MuiInputLabel-root')).toHaveLength(labelableFieldCount);
  });

  it('gives the grid row a visible, non-<label> caption with no dangling htmlFor, and the grid keeps its accessible name', async () => {
    const { container } = render(<Host labelPlacement="start" />);

    // No real `<label>` exists for the grid: its caption renders as a plain
    // span (see FieldRow's `labelable`), so it never shows up in this query.
    const caption = screen.getByText('Vehicles');
    expect(caption.tagName).toBe('SPAN');
    expect(caption.closest('label')).toBeNull();

    // Belt-and-braces: every `<label>` that *does* exist in the document
    // still resolves its `for` to a real element — none dangles.
    for (const label of Array.from(container.querySelectorAll('label'))) {
      const forId = label.getAttribute('for');
      if (forId) expect(document.getElementById(forId)).not.toBeNull();
    }

    // The grid's own name comes from `ObjectGrid`'s unconditional aria-label,
    // independent of FieldRow — this is what keeps the grid accessible even
    // though its row draws no `<label htmlFor>` for it.
    const grid = await screen.findByRole('grid');
    expect(grid).toHaveAttribute('aria-label', 'Vehicles');
  });
});

describe('grid field, labelPlacement=float', () => {
  it('is unaffected by the labelable fix — still draws its own caption, never a <label>', () => {
    render(<Host />); // default placement: 'float'
    // `FieldRow` draws no label of its own in `'float'` mode regardless of
    // `labelable` (the early return in `FieldRow` short-circuits before that
    // prop is even read), so the grid keeps drawing its own caption exactly
    // as it did before this fix — this pins the default path stays untouched.
    // (Other fields' own MUI floating labels *are* real `<label for>`
    // elements in this mode, so the assertion is scoped to the grid's
    // caption specifically, not "no label in the document".)
    const caption = screen.getByText('Vehicles');
    expect(caption.tagName).not.toBe('LABEL');
    expect(caption.closest('label')).toBeNull();
  });
});
