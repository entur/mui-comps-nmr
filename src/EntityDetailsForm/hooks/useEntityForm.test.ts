import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { UseEntityFormProps } from './useEntityForm';
import { useEntityForm } from './useEntityForm';
import type { FieldSpec } from '../types';

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

const fields: Record<string, FieldSpec> = {
  netexId: { kind: 'text', path: ['netexId'] },
  name: { kind: 'name', path: ['name'] },
  version: { kind: 'text', path: ['version'], serverManaged: true },
};

describe('useEntityForm', () => {
  beforeEach(() => {
    mockFns.request.mockReset();
  });

  it('loads an entity on mount when netexId is provided', async () => {
    mockFns.request.mockResolvedValueOnce({
      vehicles: { content: [{ netexId: 'VEH:1', name: { value: 'Tram' } }] },
    });

    const { result } = renderHook(() =>
      useEntityForm({
        fields,
        endpoint: 'http://test',
        netexId: 'VEH:1',
        query: {
          document: vehicleDoc,
          variables: (id: string) => ({ filter: { netexIds: [id] } }),
          resultPath: ['vehicles', 'content', 0] as const,
        },
        mutation: {
          document: mutationDoc,
          resultPath: ['createOrUpdateVehicle'] as const,
        },
      })
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.value).toEqual({ netexId: 'VEH:1', name: { value: 'Tram' } });
    expect(result.current.errors).toEqual({});
    expect(mockFns.request).toHaveBeenCalledWith(vehicleDoc, { filter: { netexIds: ['VEH:1'] } });
  });

  it('clears value when netexId is removed', async () => {
    mockFns.request.mockResolvedValueOnce({
      vehicles: { content: [{ netexId: 'VEH:1', name: { value: 'Tram' } }] },
    });

    const { result, rerender } = renderHook(
      (props: UseEntityFormProps) => useEntityForm(props),
      {
        initialProps: {
          fields,
          endpoint: 'http://test',
          netexId: 'VEH:1',
          query: {
            document: vehicleDoc,
            variables: (id: string) => ({ filter: { netexIds: [id] } }),
            resultPath: ['vehicles', 'content', 0] as const,
          },
          mutation: {
            document: mutationDoc,
            resultPath: ['createOrUpdateVehicle'] as const,
          },
        } as UseEntityFormProps,
      }
    );

    await waitFor(() => expect(result.current.value).toEqual({ netexId: 'VEH:1', name: { value: 'Tram' } }));

    rerender({
      fields,
      endpoint: 'http://test',
      query: {
        document: vehicleDoc,
        variables: (id: string) => ({ filter: { netexIds: [id] } }),
        resultPath: ['vehicles', 'content', 0] as const,
      },
      mutation: {
        document: mutationDoc,
        resultPath: ['createOrUpdateVehicle'] as const,
      },
    });

    expect(result.current.value).toBeUndefined();
    expect(result.current.loading).toBe(false);
  });

  it('does not load when netexId is omitted', () => {
    const { result } = renderHook(() =>
      useEntityForm({
        fields,
        endpoint: 'http://test',
        query: {
          document: vehicleDoc,
          variables: (id: string) => ({ filter: { netexIds: [id] } }),
          resultPath: ['vehicles', 'content', 0] as const,
        },
        mutation: {
          document: mutationDoc,
          resultPath: ['createOrUpdateVehicle'] as const,
        },
      })
    );

    expect(result.current.value).toBeUndefined();
    expect(result.current.loading).toBe(false);
    expect(mockFns.request).not.toHaveBeenCalled();
  });

  it('exposes fieldErrors on load failure', async () => {
    mockFns.request.mockRejectedValueOnce({
      response: {
        errors: [
          { message: 'Not found', path: ['vehicles'] },
        ],
      },
    });

    const { result } = renderHook(() =>
      useEntityForm({
        fields,
        endpoint: 'http://test',
        netexId: 'VEH:99',
        query: {
          document: vehicleDoc,
          variables: (id: string) => ({ filter: { netexIds: [id] } }),
          resultPath: ['vehicles', 'content', 0] as const,
        },
        mutation: {
          document: mutationDoc,
          resultPath: ['createOrUpdateVehicle'] as const,
        },
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.errors).toEqual({ __init: 'Failed to load' });
    expect(result.current.value).toBeUndefined();
  });

  it('waits for async getHeaders before loading', async () => {
    let resolveHeaders: (h: Record<string, string>) => void = () => {};
    const getHeaders = () =>
      new Promise<Record<string, string>>(resolve => {
        resolveHeaders = resolve;
      });

    mockFns.request.mockResolvedValueOnce({
      vehicles: { content: [{ netexId: 'VEH:1', name: { value: 'Tram' } }] },
    });

    const { result } = renderHook(
      (props: UseEntityFormProps) => useEntityForm(props),
      {
        initialProps: {
          fields,
          endpoint: 'http://test',
          netexId: 'VEH:1',
          getHeaders,
          query: {
            document: vehicleDoc,
            variables: (id: string) => ({ filter: { netexIds: [id] } }),
            resultPath: ['vehicles', 'content', 0] as const,
          },
          mutation: {
            document: mutationDoc,
            resultPath: ['createOrUpdateVehicle'] as const,
          },
        },
      }
    );

    // Should not issue the request while dynamic headers are still pending.
    expect(result.current.loading).toBe(false);
    expect(mockFns.request).not.toHaveBeenCalled();

    act(() => resolveHeaders({ Authorization: 'Bearer token' }));

    // After headers resolve, the request runs with merged static + dynamic headers.
    await waitFor(() => expect(mockFns.request).toHaveBeenCalled());

    expect(result.current.value).toEqual({ netexId: 'VEH:1', name: { value: 'Tram' } });
    expect(mockFns.setHeaders).toHaveBeenLastCalledWith({ Authorization: 'Bearer token' });
    expect(mockFns.request).toHaveBeenCalledWith(vehicleDoc, { filter: { netexIds: ['VEH:1'] } });
  });

  it('ignores a stale response when netexId changes', async () => {
    let resolveA: (data: unknown) => void = () => {};

    mockFns.request
      .mockImplementationOnce(
        () => new Promise(resolve => {
          resolveA = resolve;
        })
      )
      .mockResolvedValueOnce({
        vehicles: { content: [{ netexId: 'VEH:2', name: { value: 'Bus' } }] },
      });

    const { result, rerender } = renderHook(
      (props: UseEntityFormProps) => useEntityForm(props),
      {
        initialProps: {
          fields,
          endpoint: 'http://test',
          netexId: 'VEH:1',
          query: {
            document: vehicleDoc,
            variables: (id: string) => ({ filter: { netexIds: [id] } }),
            resultPath: ['vehicles', 'content', 0] as const,
          },
          mutation: {
            document: mutationDoc,
            resultPath: ['createOrUpdateVehicle'] as const,
          },
        },
      }
    );

    await waitFor(() => expect(result.current.loading).toBe(true));

    rerender({
      fields,
      endpoint: 'http://test',
      netexId: 'VEH:2',
      query: {
        document: vehicleDoc,
        variables: (id: string) => ({ filter: { netexIds: [id] } }),
        resultPath: ['vehicles', 'content', 0] as const,
      },
      mutation: {
        document: mutationDoc,
        resultPath: ['createOrUpdateVehicle'] as const,
      },
    });

    // Resolve the newer request first.
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.value).toEqual({ netexId: 'VEH:2', name: { value: 'Bus' } });

    // Now resolve the stale request for VEH:1.
    act(() => resolveA({ vehicles: { content: [{ netexId: 'VEH:1', name: { value: 'Tram' } }] } }));

    // The stale response must not overwrite the current value.
    await new Promise(r => setTimeout(r, 50));
    expect(result.current.value).toEqual({ netexId: 'VEH:2', name: { value: 'Bus' } });
    expect(result.current.errors).toEqual({});
  });

  it('saves, returns the id, and refetches', async () => {
    mockFns.request
      .mockResolvedValueOnce({
        vehicles: { content: [{ netexId: 'VEH:1', name: { value: 'Tram' } }] },
      })
      .mockResolvedValueOnce({ createOrUpdateVehicle: 'VEH:1' })
      .mockResolvedValueOnce({
        vehicles: { content: [{ netexId: 'VEH:1', name: { value: 'Tram Updated' } }] },
      });

    const onSaved = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(() =>
      useEntityForm({
        fields,
        endpoint: 'http://test',
        netexId: 'VEH:1',
        query: {
          document: vehicleDoc,
          variables: (id: string) => ({ filter: { netexIds: [id] } }),
          resultPath: ['vehicles', 'content', 0] as const,
        },
        mutation: {
          document: mutationDoc,
          resultPath: ['createOrUpdateVehicle'] as const,
        },
        onSaved,
        onError,
      })
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Simulate an edit
    result.current.setValue({ netexId: 'VEH:1', name: { value: 'Tram Updated' } });
    await waitFor(() => expect((result.current.value as any)?.name?.value).toBe('Tram Updated'));

    await act(async () => result.current.handleSave());

    await waitFor(() => expect(result.current.saving).toBe(false));

    expect(mockFns.request).toHaveBeenNthCalledWith(2, mutationDoc, {
      input: { netexId: 'VEH:1', name: { value: 'Tram Updated' } },
    });
    expect(mockFns.request).toHaveBeenNthCalledWith(3, vehicleDoc, {
      filter: { netexIds: ['VEH:1'] },
    });
    expect(result.current.value).toEqual({ netexId: 'VEH:1', name: { value: 'Tram Updated' } });
    expect(onSaved).toHaveBeenCalledWith('VEH:1');
    expect(onError).not.toHaveBeenCalled();
  });
});
