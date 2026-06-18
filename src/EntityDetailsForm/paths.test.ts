import { describe, it, expect } from 'vitest';
import { getPath, setPath } from './paths';

describe('getPath', () => {
  it('reads a top-level value', () => {
    expect(getPath({ length: 5 }, ['length'])).toBe(5);
  });
  it('reads a nested leaf', () => {
    expect(getPath({ cap: { seating: 3 } }, ['cap', 'seating'])).toBe(3);
  });
  it('returns undefined through a missing branch', () => {
    expect(getPath({}, ['cap', 'seating'])).toBeUndefined();
  });
});

describe('setPath', () => {
  it('sets a top-level value immutably', () => {
    const src = { length: 1 };
    const out = setPath(src, ['length'], 2);
    expect(out).toEqual({ length: 2 });
    expect(src).toEqual({ length: 1 }); // unchanged
  });
  it('sets a nested leaf, creating the branch', () => {
    expect(setPath({}, ['cap', 'seating'], 9)).toEqual({ cap: { seating: 9 } });
  });
  it('prunes an emptied nested object back to undefined', () => {
    const out = setPath({ cap: { seating: 9 } }, ['cap', 'seating'], undefined);
    expect(out.cap).toBeUndefined();
  });
  it('keeps a nested object that still has values', () => {
    const out = setPath({ cap: { seating: 9, total: 10 } }, ['cap', 'seating'], undefined);
    expect(out.cap).toEqual({ seating: undefined, total: 10 });
  });
});
