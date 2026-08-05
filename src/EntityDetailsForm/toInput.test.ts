import { describe, it, expect } from 'vitest';
import { toInputEntity } from './toInput';
import type { FieldSpec } from './types';

interface Vehicle {
  netexId: string;
  dataOwnerRef: string;
  name?: { lang?: string; value?: string } | null;
  registrationNumber?: string | null;
  transportType?: { netexId: string } | null;
  version?: string | null;
  created?: string | null;
  changedBy?: string | null;
}

const vehicleFields: Record<string, FieldSpec> = {
  netexId: { kind: 'text', path: ['netexId'] },
  dataOwnerRef: { kind: 'text', path: ['dataOwnerRef'] },
  name: { kind: 'name', path: ['name'] },
  registrationNumber: { kind: 'text', path: ['registrationNumber'] },
  transportType: { kind: 'reference', path: ['transportType', 'netexId'] },
  version: { kind: 'text', path: ['version'], serverManaged: true },
  created: { kind: 'datetime', path: ['created'], serverManaged: true },
  changedBy: { kind: 'text', path: ['changedBy'], serverManaged: true },
};

describe('toInputEntity', () => {
  it('copies non-serverManaged fields by path', () => {
    const entity: Vehicle = {
      netexId: 'VEH:1',
      dataOwnerRef: 'ENT:1',
      name: { lang: 'en', value: 'Tram' },
    };
    const input = toInputEntity(entity, vehicleFields);
    expect(input.netexId).toBe('VEH:1');
    expect(input.dataOwnerRef).toBe('ENT:1');
    expect(input.name).toEqual({ lang: 'en', value: 'Tram' });
  });

  it('skips serverManaged fields', () => {
    const entity: Vehicle = {
      netexId: 'VEH:1',
      dataOwnerRef: 'ENT:1',
      version: '3',
      created: '2024-01-01T00:00:00Z',
      changedBy: 'admin',
    };
    const input = toInputEntity(entity, vehicleFields);
    expect(input).not.toHaveProperty('version');
    expect(input).not.toHaveProperty('created');
    expect(input).not.toHaveProperty('changedBy');
    expect(input.netexId).toBe('VEH:1');
  });

  it('copies the parent object for reference fields', () => {
    const entity: Vehicle = {
      netexId: 'VEH:1',
      dataOwnerRef: 'ENT:1',
      transportType: { netexId: 'VT:1' },
    };
    const input = toInputEntity(entity, vehicleFields);
    expect(input.transportType).toEqual({ netexId: 'VT:1' });
  });

  it('omits undefined/null values', () => {
    const entity: Vehicle = {
      netexId: 'VEH:1',
      dataOwnerRef: 'ENT:1',
      registrationNumber: null,
    };
    const input = toInputEntity(entity, vehicleFields);
    expect(input).not.toHaveProperty('registrationNumber');
  });

  it('prunes empty nested objects', () => {
    const entity: Vehicle = {
      netexId: 'VEH:1',
      dataOwnerRef: 'ENT:1',
      name: { lang: undefined, value: undefined },
    };
    const input = toInputEntity(entity, vehicleFields);
    expect(input).not.toHaveProperty('name');
  });
});
