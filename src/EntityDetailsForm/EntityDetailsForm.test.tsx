import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { createEntityDetailsForm } from './index';
import type { FieldSpec, EntityDetailsFormProps } from './types';

interface V {
  name?: { value?: string | null } | null;
  length?: number | null;
  version?: number | null;
}

const fields: Record<string, FieldSpec> = {
  name: { kind: 'name', path: ['name'] },
  length: { kind: 'number', path: ['length'] },
  version: { kind: 'number', path: ['version'], serverManaged: true },
};

const Form = createEntityDetailsForm<V>(fields);

const Host = (props: Partial<EntityDetailsFormProps<V>>) => {
  const [v, setV] = useState<V>({ name: { value: 'Tram' }, length: 5, version: 1 });
  return <Form value={v} onChange={setV} mode="edit" {...props} />;
};

describe('createEntityDetailsForm', () => {
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
    const SwForm = createEntityDetailsForm<{ active?: boolean }>({
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
    const DForm = createEntityDetailsForm<{ built?: string | null }>({
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
  const RefForm = createEntityDetailsForm<R>(refFields);

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
});
