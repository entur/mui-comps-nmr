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

  it('renders a not-found state for a settled zero-row load (guarded on netexId)', () => {
    expect(src).toMatch(
      /if \(!loading && !value && netexId\) return <div>Not found: \{netexId\}<\/div>;/
    );
  });

  it('falls back to a display-only dataOwnerRef from context in create mode', () => {
    expect(src).toMatch(/const \{ dataOwnerRef \} = useSobekCtx\(\);/);
    expect(src).toMatch(/value=\{value \?\? \(\{ dataOwnerRef \} as Vehicle\)\}/);
    expect(src).toMatch(/import \{ useSobekCtx \} from '\.\.\/\.\.\/context\/SobekContext';/);
  });
});
