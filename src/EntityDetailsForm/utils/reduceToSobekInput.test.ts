import { describe, expect, it } from 'vitest';
import { reduceToSobekInput } from './reduceToSobekInput';

describe('reduceToSobekInput', () => {
  it('keeps keys the mask declares', () => {
    const out = reduceToSobekInput({ netexId: 'X', weight: 12 }, { netexId: 1, weight: 1 });
    expect(out).toEqual({ netexId: 'X', weight: 12 });
  });

  it('drops keys the mask omits', () => {
    const out = reduceToSobekInput(
      { netexId: 'X', manufacturer: 'Stadler' },
      { netexId: 1 }
    );
    expect(out).toEqual({ netexId: 'X' });
  });

  it('passes nested values through by reference', () => {
    const name = { value: 'FLIRT', lang: 'no' };
    const out = reduceToSobekInput({ name }, { name: 1 });
    expect(out.name).toBe(name);
  });

  it('keeps a declared key whose value is falsy', () => {
    const out = reduceToSobekInput({ lowFloor: false }, { lowFloor: 1 });
    expect(out).toEqual({ lowFloor: false });
  });

  it('does not invent keys the input lacks', () => {
    const out = reduceToSobekInput({}, { netexId: 1, weight: 1 });
    expect(out).toEqual({});
  });
});
