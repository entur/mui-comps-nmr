import { describe, it, expect } from 'vitest';
import { normalizeEntityErrors } from './normalizeErrors';
import type { FieldSpec } from './types';

const fields: Record<string, FieldSpec> = {
  netexId: { kind: 'text', path: ['netexId'] },
  name: { kind: 'name', path: ['name'] },
  registrationNumber: { kind: 'text', path: ['registrationNumber'] },
  version: { kind: 'text', path: ['version'], serverManaged: true },
};

describe('normalizeEntityErrors', () => {
  it('returns empty when no errors', () => {
    const { fieldErrors, generalErrors } = normalizeEntityErrors(null, fields);
    expect(Object.keys(fieldErrors)).toHaveLength(0);
    expect(generalErrors).toHaveLength(0);
  });

  it('maps a field error by path key', () => {
    const err = {
      response: {
        errors: [
          { message: 'Required field', path: ['createOrUpdateVehicle', 'input', 'registrationNumber'] },
        ],
      },
    };
    const { fieldErrors, generalErrors } = normalizeEntityErrors(err, fields);
    expect(fieldErrors.registrationNumber).toBe('Required field');
    expect(generalErrors).toHaveLength(0);
  });

  it('skips path keys that are not in FIELDS', () => {
    const err = {
      response: {
        errors: [
          { message: 'Bad mutation', path: ['createOrUpdateVehicle'] },
          { message: 'Weird field', path: ['createOrUpdateVehicle', 'input', 'fooBar'] },
        ],
      },
    };
    const { fieldErrors, generalErrors } = normalizeEntityErrors(err, fields);
    expect(Object.keys(fieldErrors)).toHaveLength(0);
    expect(generalErrors).toEqual(['Bad mutation', 'Weird field']);
  });

  it('distinguishes serverManaged-only errors as general', () => {
    const err = {
      response: {
        errors: [
          { message: 'Version mismatch', path: ['createOrUpdateVehicle', 'input', 'version'] },
        ],
      },
    };
    const { fieldErrors, generalErrors } = normalizeEntityErrors(err, fields);
    expect(Object.keys(fieldErrors)).toHaveLength(0);
    expect(generalErrors).toEqual(['Version mismatch']);
  });

  it('handles multiple errors of both kinds', () => {
    const err = {
      response: {
        errors: [
          { message: 'Missing name', path: ['createOrUpdateVehicle', 'input', 'name'] },
          { message: 'Server down', path: ['createOrUpdateVehicle'] },
          { message: 'Invalid id', path: ['createOrUpdateVehicle', 'input', 'netexId'] },
        ],
      },
    };
    const { fieldErrors, generalErrors } = normalizeEntityErrors(err, fields);
    expect(fieldErrors.name).toBe('Missing name');
    expect(fieldErrors.netexId).toBe('Invalid id');
    expect(generalErrors).toEqual(['Server down']);
  });
});
