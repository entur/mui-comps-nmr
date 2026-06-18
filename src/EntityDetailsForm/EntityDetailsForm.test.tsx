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
});
