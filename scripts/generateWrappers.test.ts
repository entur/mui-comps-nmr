import { describe, it, expect } from 'vitest';
import { renderWrapperSource, renderBarrel } from './generateWrappers';

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

  it('declares the host observation callbacks on the props interface', () => {
    // Not passed to the presentation: they fall into `...rest` and reach
    // `useEntityForm`, which owns both the value and the baseline.
    expect(src).toMatch(/onChange\?: \(value: Vehicle \| undefined\) => void;/);
    expect(src).toMatch(/onDirtyChange\?: \(dirty: boolean\) => void;/);
  });

  it('renders the dirty-gated action footer in place of the bare Save button', () => {
    expect(src).toMatch(/import \{ EditFooter \} from '\.\.\/components\/EditFooter';/);
    expect(src).not.toMatch(/<button onClick=\{handleSave\}/);
    expect(src).toMatch(/dirty=\{dirty\}/);
    expect(src).toMatch(/onSave=\{handleSave\}/);
    // Cancel is the hook's in-place discard, not a remount — the wrapper owns
    // no `key` of its own and cannot re-mount itself.
    expect(src).toMatch(/onCancel=\{reset\}/);
    expect(src).toMatch(/const \{ value, setValue, reset, loading, saving, load, dirty, errors, handleSave \}/);
  });

  it('exposes the footer to the host for labels and styling', () => {
    // The wrapper renders the footer itself, so without a passthrough a host
    // can neither localize it (English defaults, no i18n runtime here) nor theme
    // it. `EditFooterHostProps` omits the state the hook owns.
    expect(src).toMatch(/footerProps\?: EditFooterHostProps;/);
    // Spread before the controlled props: the type already forbids overriding
    // them, but the order makes it true at runtime too.
    expect(src).toMatch(/<EditFooter\s+\{\.\.\.footerProps\}\s+dirty=\{dirty\}/);
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

describe('renderBarrel', () => {
  it('re-exports each wrapper component and its props type', () => {
    const out = renderBarrel([entry]);
    expect(out).toMatch(/export \{ VehicleForm \} from '\.\/vehicle';/);
    // Hosts otherwise reconstruct these with `ComponentProps<typeof VehicleForm>`.
    expect(out).toMatch(/export type \{ VehicleFormProps \} from '\.\/vehicle';/);
  });
});
