import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { VehicleTypeForm } from './VehicleTypeForm';
import type { VehicleType } from '../../generated/sobekTypes';

const base: VehicleType = { netexId: 'X:VehicleType:1', name: { value: 'Tram' } };

/** Controlled host mirroring how a consumer wires value/onChange. */
const Host = ({ mode }: { mode: 'view' | 'edit' }) => {
  const [v, setV] = useState<VehicleType>(base);
  return <VehicleTypeForm value={v} onChange={setV} mode={mode} />;
};

describe('VehicleTypeForm', () => {
  it('edits a name field and round-trips through onChange', () => {
    render(<Host mode="edit" />);
    const input = screen.getByLabelText('Name') as HTMLInputElement;
    expect(input.value).toBe('Tram');
    fireEvent.change(input, { target: { value: 'Tram 2' } });
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Tram 2');
  });

  it('disables inputs in view mode', () => {
    render(<Host mode="view" />);
    expect(screen.getByLabelText('Name')).toBeDisabled();
  });
});
