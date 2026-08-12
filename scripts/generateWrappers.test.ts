import { describe, it, expect } from 'vitest';
import { renderWrapperSource } from './generateWrappers';

const entry = {
  entity: 'Vehicle',
  queryRoot: 'vehicles',
  mutationName: 'createOrUpdateVehicle',
  ignore: [],
  relationFields: ['transportType'],
};

describe('renderWrapperSource', () => {
  const src = renderWrapperSource(entry);

  it('drops endpoint/headers/getHeaders from the props interface (provider-only)', () => {
    const propsBlock = src.slice(src.indexOf('export interface'), src.indexOf('}', src.indexOf('export interface')));
    expect(propsBlock).not.toMatch(/\bendpoint\b/);
    expect(propsBlock).not.toMatch(/\bheaders\?/);
    expect(propsBlock).not.toMatch(/\bgetHeaders\b/);
  });

  it('has no dataOwnerRef: \'\' literal; variables receives it from the hook', () => {
    expect(src).not.toMatch(/dataOwnerRef: ''/);
    expect(src).toMatch(
      /variables: \(netexId, dataOwnerRef\) => \(\{ filter: \{ netexIds: \[netexId\], dataOwnerRef \} \}\)/
    );
  });

  it('hands the generated wire-key mask to the mutation config', () => {
    expect(src).toMatch(/import \{ VehicleInputKeys \} from '\.\.\/\.\.\/generated\/operations\/inputKeys';/);
    expect(src).toMatch(/inputKeys: VehicleInputKeys,/);
  });

  it('gates not-found on the settled load phase, never on `loading`', () => {
    // `loading` is false on the first commit (LOAD_START fires from a passive
    // effect), so a not-found branch gated on it flashes on every mount.
    expect(src).not.toMatch(/!loading && !value && netexId/);
    expect(src).toMatch(
      /if \(netexId && !value && load === 'ok'\) return <div>Not found: \{netexId\}<\/div>;/
    );
  });

  it('distinguishes a failed load from a missing record', () => {
    expect(src).toMatch(/if \(netexId && load === 'error'\) return <div>\{errors\.__init\}<\/div>;/);
  });

  it('overlays the display-only dataOwnerRef from context on every render', () => {
    expect(src).toMatch(/const \{ dataOwnerRef \} = useSobekCtx\(\);/);
    // Not `value ?? …`: that freezes the control at the org current when the
    // user first typed, while the save stamps whatever context holds now.
    expect(src).toMatch(/value=\{\{ \.\.\.\(value \?\? \(\{\} as Vehicle\)\), dataOwnerRef \}\}/);
    expect(src).toMatch(/import \{ useSobekCtx \} from '\.\.\/\.\.\/context\/SobekContext';/);
  });
});
