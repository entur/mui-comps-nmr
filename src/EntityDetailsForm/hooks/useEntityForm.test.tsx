import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { UseEntityFormProps } from './useEntityForm';
import { useEntityForm } from './useEntityForm';
import type { FieldSpec } from '../types';
import { SobekProvider, type SobekCtx } from '../../context/SobekContext';

const mockFns = vi.hoisted(() => ({
  request: vi.fn(),
  setHeaders: vi.fn(),
}));

vi.mock('graphql-request', () => ({
  __esModule: true,
  GraphQLClient: vi.fn().mockImplementation(function (this: any) {
    this.request = mockFns.request;
    this.setHeaders = mockFns.setHeaders;
  }),
}));

const vehicleDoc = { kind: 'Document' } as any;
const mutationDoc = { kind: 'Document' } as any;

const ENDPOINT = 'http://test';
const OWNER_REF = 'NOG:Authority:test';
const OTHER_REF = 'NOG:Authority:other';
const TRAM = { netexId: 'VEH:1', name: { value: 'Tram' } };
const BUS = { netexId: 'VEH:2', name: { value: 'Bus' } };

const fields: Record<string, FieldSpec> = {
  netexId: { kind: 'text', path: ['netexId'] },
  name: { kind: 'name', path: ['name'] },
  version: { kind: 'text', path: ['version'], serverManaged: true },
  dataOwnerRef: { kind: 'text', path: ['dataOwnerRef'], locked: true },
};

/**
 * Stand-in for the generated `<Entity>InputKeys` mask. Mirrors `fields` minus
 * the server-managed `version`, which the live Input type would not carry.
 */
const wireKeys = { netexId: 1, name: 1, dataOwnerRef: 1 };

/** Wraps an entity in the query's `vehicles.content[0]` result envelope. */
const envelope = (entity: unknown) => ({ vehicles: { content: [entity] } });

/**
 * The ambient session inputs the hook reads. Tests mutate this between
 * renders (then `rerender`) to simulate the host re-rendering the provider.
 */
let ctx: SobekCtx;

const wrapper = ({ children }: { children: ReactNode }) => (
  <SobekProvider value={ctx}>{children}</SobekProvider>
);

/**
 * Builds hook props with the standard Vehicle query/mutation config.
 *
 * Every call mints fresh object literals — matching a host that passes inline
 * props each render, which the hook must tolerate without re-loading.
 *
 * @param {Partial<UseEntityFormProps>} over - per-test overrides (netexId, callbacks…).
 * @returns {UseEntityFormProps} props ready for `renderHook`.
 */
const mkProps = (over: Partial<UseEntityFormProps> = {}): UseEntityFormProps => ({
  fields,
  query: {
    document: vehicleDoc,
    variables: (id: string, dataOwnerRef: string) => ({
      filter: { netexIds: [id], dataOwnerRef },
    }),
    resultPath: ['vehicles', 'content', 0] as const,
  },
  mutation: {
    document: mutationDoc,
    resultPath: ['createOrUpdateVehicle'] as const,
    inputKeys: wireKeys,
  },
  ...over,
});

const renderForm = (props: UseEntityFormProps) =>
  renderHook((p: UseEntityFormProps) => useEntityForm(p), { initialProps: props, wrapper });

describe('useEntityForm', () => {
  beforeEach(() => {
    mockFns.request.mockReset();
    mockFns.setHeaders.mockReset();
    ctx = { endpoint: ENDPOINT, dataOwnerRef: OWNER_REF };
  });

  it('throws when no SobekProvider is above', () => {
    expect(() => renderHook(() => useEntityForm(mkProps({ netexId: 'VEH:1' })))).toThrow(
      'mui-comps-nmr: this component must be rendered inside a <SobekProvider>'
    );
  });

  it('loads an entity on mount when netexId is provided', async () => {
    mockFns.request.mockResolvedValueOnce(envelope(TRAM));

    const { result } = renderForm(mkProps({ netexId: 'VEH:1' }));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.value).toEqual(TRAM);
    expect(result.current.errors).toEqual({});
    expect(mockFns.request).toHaveBeenCalledWith(vehicleDoc, {
      filter: { netexIds: ['VEH:1'], dataOwnerRef: OWNER_REF },
    });
  });

  it('keeps the loaded value when netexId is removed (create mode preserves edits)', async () => {
    mockFns.request.mockResolvedValueOnce(envelope(TRAM));

    const { result, rerender } = renderForm(mkProps({ netexId: 'VEH:1' }));

    await waitFor(() => expect(result.current.value).toEqual(TRAM));

    rerender(mkProps());

    // Removing netexId no longer wipes state: the load effect early-returns on a
    // missing netexId (create mode), so any in-progress value is preserved rather
    // than cleared.
    expect(result.current.value).toEqual(TRAM);
    expect(result.current.loading).toBe(false);
  });

  it('invalidates an in-flight load when switching to create mode', async () => {
    let resolveLoad: (data: unknown) => void = () => {};
    mockFns.request.mockImplementationOnce(
      () => new Promise(resolve => {
        resolveLoad = resolve;
      })
    );

    const { result, rerender } = renderForm(mkProps({ netexId: 'VEH:1' }));

    await waitFor(() => expect(result.current.loading).toBe(true));

    // Host drops netexId (edit -> create) while the load is still in flight.
    rerender(mkProps());
    expect(result.current.loading).toBe(false);

    // The late response belongs to the abandoned edit form — it must not
    // repopulate the create form.
    act(() => resolveLoad(envelope(TRAM)));
    await new Promise(r => setTimeout(r, 50));

    expect(result.current.value).toBeUndefined();
    expect(result.current.loading).toBe(false);
  });

  it('does not load when netexId is omitted', () => {
    const { result } = renderForm(mkProps());

    expect(result.current.value).toBeUndefined();
    expect(result.current.loading).toBe(false);
    expect(mockFns.request).not.toHaveBeenCalled();
  });

  it('surfaces the server message on load failure, to state and to onError', async () => {
    const onError = vi.fn();
    mockFns.request.mockRejectedValueOnce({
      response: {
        errors: [
          { message: 'Not found', path: ['vehicles'] },
        ],
      },
    });

    const { result } = renderForm(mkProps({ netexId: 'VEH:99', onError }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    // The load half mirrors the save half: the server's own words reach the
    // host, not a constant that flattens 401/403/404/socket-drop into one string.
    expect(result.current.errors).toEqual({ __init: 'Not found' });
    expect(onError).toHaveBeenCalledWith(['Not found']);
    expect(result.current.value).toBeUndefined();
  });

  it('falls back to a constant when a load failure carries no GraphQL errors', async () => {
    const onError = vi.fn();
    mockFns.request.mockRejectedValueOnce(new Error('boom'));

    const { result } = renderForm(mkProps({ netexId: 'VEH:99', onError }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.errors).toEqual({ __init: 'Failed to load' });
    expect(onError).toHaveBeenCalledWith(['Failed to load']);
  });

  it('joins multiple load errors for display but hands onError the array', async () => {
    const onError = vi.fn();
    mockFns.request.mockRejectedValueOnce({
      response: {
        errors: [{ message: 'Unauthorized' }, { message: 'Token expired' }],
      },
    });

    const { result } = renderForm(mkProps({ netexId: 'VEH:99', onError }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.errors).toEqual({ __init: 'Unauthorized; Token expired' });
    expect(onError).toHaveBeenCalledWith(['Unauthorized', 'Token expired']);
  });

  it('does not call onError for a load retired before it failed', async () => {
    const onError = vi.fn();
    let rejectLoad: (e: unknown) => void = () => {};
    mockFns.request.mockImplementationOnce(
      () => new Promise((_resolve, reject) => {
        rejectLoad = reject;
      })
    );

    const { result, rerender } = renderForm(mkProps({ netexId: 'VEH:1', onError }));

    await waitFor(() => expect(result.current.loading).toBe(true));

    // Host drops netexId (edit -> create) while the load is still in flight.
    rerender(mkProps({ onError }));

    // The failure belongs to the abandoned edit form. The reducer discards the
    // dispatch on its own epoch check, but a callback has no reducer to protect
    // it — without an explicit guard the host pops an error for a form that has
    // already moved on.
    act(() => rejectLoad(new Error('boom')));
    await new Promise(r => setTimeout(r, 50));

    expect(onError).not.toHaveBeenCalled();
    expect(result.current.errors).toEqual({});
  });

  it('waits for async getHeaders, then merges dynamic over static headers', async () => {
    let resolveHeaders: (h: Record<string, string>) => void = () => {};
    ctx = {
      ...ctx,
      // `Authorization` here must lose to the dynamic value below.
      headers: { 'Client-Name': 'hathor', Authorization: 'static-fallback' },
      getHeaders: () =>
        new Promise<Record<string, string>>(resolve => {
          resolveHeaders = resolve;
        }),
    };

    mockFns.request.mockResolvedValueOnce(envelope(TRAM));

    const { result } = renderForm(mkProps({ netexId: 'VEH:1' }));

    // Should not issue the request while dynamic headers are still pending —
    // but the load is already in flight, so the form reports `loading`.
    expect(result.current.loading).toBe(true);
    expect(mockFns.request).not.toHaveBeenCalled();

    act(() => resolveHeaders({ Authorization: 'Bearer token' }));

    await waitFor(() => expect(mockFns.request).toHaveBeenCalled());

    expect(result.current.value).toEqual(TRAM);
    expect(mockFns.setHeaders).toHaveBeenLastCalledWith({
      'Client-Name': 'hathor',
      Authorization: 'Bearer token',
    });
    expect(mockFns.request).toHaveBeenCalledWith(vehicleDoc, {
      filter: { netexIds: ['VEH:1'], dataOwnerRef: OWNER_REF },
    });
  });

  it('ignores headers/getHeaders identity churn (no reload, edits preserved)', async () => {
    mockFns.request.mockResolvedValue(envelope(TRAM));

    // Fresh inline literals every render — exactly what the README recommends.
    const churnCtx = () => {
      ctx = {
        endpoint: ENDPOINT,
        dataOwnerRef: OWNER_REF,
        headers: { 'Client-Name': 'hathor' },
        getHeaders: () => ({ Authorization: 'Bearer token' }),
      };
    };
    churnCtx();

    const { result, rerender } = renderForm(mkProps({ netexId: 'VEH:1' }));

    await waitFor(() => expect(result.current.value).toEqual(TRAM));
    expect(mockFns.request).toHaveBeenCalledTimes(1);

    act(() => result.current.setValue({ netexId: 'VEH:1', name: { value: 'Edited' } } as any));

    churnCtx();
    rerender(mkProps({ netexId: 'VEH:1' }));
    churnCtx();
    rerender(mkProps({ netexId: 'VEH:1' }));
    await new Promise(r => setTimeout(r, 50));

    expect(mockFns.request).toHaveBeenCalledTimes(1);
    expect(result.current.value).toEqual({ netexId: 'VEH:1', name: { value: 'Edited' } });
  });

  it('re-fires the load when dataOwnerRef changes (org switch)', async () => {
    mockFns.request
      .mockResolvedValueOnce(envelope(TRAM))
      .mockResolvedValueOnce(envelope(BUS));

    const { result, rerender } = renderForm(mkProps({ netexId: 'VEH:1' }));

    await waitFor(() => expect(result.current.value).toEqual(TRAM));
    expect(mockFns.request).toHaveBeenCalledTimes(1);

    // Host switches organisation — same endpoint, new dataOwnerRef.
    ctx = { endpoint: ENDPOINT, dataOwnerRef: OTHER_REF };
    rerender(mkProps({ netexId: 'VEH:1' }));

    await waitFor(() => expect(mockFns.request).toHaveBeenCalledTimes(2));
    expect(mockFns.request).toHaveBeenNthCalledWith(2, vehicleDoc, {
      filter: { netexIds: ['VEH:1'], dataOwnerRef: OTHER_REF },
    });
    await waitFor(() => expect(result.current.value).toEqual(BUS));
  });

  it('ignores a stale response when netexId changes', async () => {
    let resolveA: (data: unknown) => void = () => {};

    mockFns.request
      .mockImplementationOnce(
        () => new Promise(resolve => {
          resolveA = resolve;
        })
      )
      .mockResolvedValueOnce(envelope(BUS));

    const { result, rerender } = renderForm(mkProps({ netexId: 'VEH:1' }));

    await waitFor(() => expect(result.current.loading).toBe(true));

    rerender(mkProps({ netexId: 'VEH:2' }));

    // Resolve the newer request first.
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.value).toEqual(BUS);

    // Now resolve the stale request for VEH:1.
    act(() => resolveA(envelope(TRAM)));

    // The stale response must not overwrite the current value.
    await new Promise(r => setTimeout(r, 50));
    expect(result.current.value).toEqual(BUS);
    expect(result.current.errors).toEqual({});
  });

  it('clears saving when a concurrent load bumps requestId mid-save', async () => {
    let resolveMutation: (data: unknown) => void = () => {};

    mockFns.request
      .mockResolvedValueOnce(envelope(TRAM))
      .mockImplementationOnce(
        () => new Promise(resolve => {
          resolveMutation = resolve;
        })
      )
      .mockResolvedValue(envelope(BUS));

    const { result, rerender } = renderForm(mkProps({ netexId: 'VEH:1' }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setValue({ netexId: 'VEH:1', name: { value: 'Edited' } } as any));
    act(() => { void result.current.handleSave(); });
    await waitFor(() => expect(result.current.saving).toBe(true));

    // A netexId change starts a load, bumping requestId out from under the save.
    rerender(mkProps({ netexId: 'VEH:2' }));
    act(() => resolveMutation({ createOrUpdateVehicle: 'VEH:1' }));

    // The save abandons its refetch, but must still release the saving flag.
    await waitFor(() => expect(result.current.saving).toBe(false));
  });

  it('surfaces a fallback error when a save fails with no GraphQL errors', async () => {
    mockFns.request
      .mockResolvedValueOnce(envelope(TRAM))
      // Transport failure: a bare Error, no `response.errors` to normalize.
      .mockRejectedValueOnce(new Error('Failed to fetch'));

    const onError = vi.fn();

    const { result } = renderForm(mkProps({ netexId: 'VEH:1', onError }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => result.current.handleSave());
    await waitFor(() => expect(result.current.saving).toBe(false));

    expect(onError).toHaveBeenCalledWith(['Failed to save']);
  });

  it('saves, returns the id, and refetches (stamping dataOwnerRef from context)', async () => {
    const updated = { netexId: 'VEH:1', name: { value: 'Tram Updated' } };

    mockFns.request
      .mockResolvedValueOnce(envelope(TRAM))
      .mockResolvedValueOnce({ createOrUpdateVehicle: 'VEH:1' })
      .mockResolvedValueOnce(envelope(updated));

    const onSaved = vi.fn();
    const onError = vi.fn();

    const { result } = renderForm(mkProps({ netexId: 'VEH:1', onSaved, onError }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Simulate an edit — including a garbage dataOwnerRef, which must not leak
    // into the payload: the wire value is stamped from context at the edge.
    result.current.setValue({ ...updated, dataOwnerRef: 'GARBAGE' } as any);
    await waitFor(() => expect((result.current.value as any)?.name?.value).toBe('Tram Updated'));

    await act(async () => result.current.handleSave());

    await waitFor(() => expect(result.current.saving).toBe(false));

    expect(mockFns.request).toHaveBeenNthCalledWith(2, mutationDoc, {
      input: { ...updated, dataOwnerRef: OWNER_REF },
    });
    // Post-save refetch filters on the context dataOwnerRef too — otherwise
    // the reload returns zero rows and blanks the form after a successful save.
    expect(mockFns.request).toHaveBeenNthCalledWith(3, vehicleDoc, {
      filter: { netexIds: ['VEH:1'], dataOwnerRef: OWNER_REF },
    });
    expect(result.current.value).toEqual(updated);
    expect(onSaved).toHaveBeenCalledWith('VEH:1');
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports the loaded entity to onChange, before any edit', async () => {
    mockFns.request.mockResolvedValueOnce(envelope(TRAM));
    const onChange = vi.fn();

    const { result } = renderForm(mkProps({ netexId: 'VEH:1', onChange }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // A host header must be able to show the loaded name without waiting for a
    // keystroke, so this fires on the load, not only on user edits.
    expect(onChange).toHaveBeenCalledWith(TRAM);
  });

  it('reports each edit to onChange', async () => {
    mockFns.request.mockResolvedValueOnce(envelope(TRAM));
    const onChange = vi.fn();

    const { result } = renderForm(mkProps({ netexId: 'VEH:1', onChange }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const edited = { ...TRAM, name: { value: 'Tram Two' } };
    act(() => result.current.setValue(edited as any));

    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(edited));
  });

  it('flags dirty on an edit and clean again when it is reverted', async () => {
    mockFns.request.mockResolvedValueOnce(envelope(TRAM));
    const onDirtyChange = vi.fn();

    const { result } = renderForm(mkProps({ netexId: 'VEH:1', onDirtyChange }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.dirty).toBe(false);

    act(() => result.current.setValue({ ...TRAM, name: { value: 'Edited' } } as any));
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));

    act(() => result.current.setValue(TRAM as any));
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
    expect(result.current.dirty).toBe(false);
  });

  it('re-baselines on a successful save, so a saved form is clean', async () => {
    const updated = { netexId: 'VEH:1', name: { value: 'Tram Updated' } };
    mockFns.request
      .mockResolvedValueOnce(envelope(TRAM))
      .mockResolvedValueOnce({ createOrUpdateVehicle: 'VEH:1' })
      .mockResolvedValueOnce(envelope(updated));

    const onDirtyChange = vi.fn();
    const { result } = renderForm(mkProps({ netexId: 'VEH:1', onDirtyChange }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setValue(updated as any));
    await waitFor(() => expect(result.current.dirty).toBe(true));

    await act(async () => result.current.handleSave());
    await waitFor(() => expect(result.current.saving).toBe(false));

    expect(result.current.dirty).toBe(false);
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

});
