import { useReducer, useEffect, useMemo, useCallback, useRef } from 'react';
import { GraphQLClient } from 'graphql-request';
import type { FieldSpec } from '../types';
import { toInputEntity } from '../toInput';
import { normalizeEntityErrors } from '../normalizeErrors';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';

// Fallback messages for failures that carry no usable GraphQL error payload
// (transport errors, malformed responses). Hosts localize by intercepting these.
const LOAD_ERR = 'Failed to load', SAVE_ERR = 'Failed to save';

export interface EntityFormConfig {
  fields: Record<string, FieldSpec>;
  query: {
    document: TypedDocumentNode<any, any>;
    variables: (netexId: string) => unknown;
    resultPath: readonly (string | number)[];
  };
  mutation: {
    document: TypedDocumentNode<any, any>;
    resultPath: readonly (string | number)[];
  };
}

export interface UseEntityFormProps extends EntityFormConfig {
  endpoint: string;
  headers?: Record<string, string>;
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
  netexId?: string;
  onSaved?: (netexId: string) => void;
  onError?: (generalErrors: string[]) => void;
}

// --- Reducer: explicit async state machine -----------------------------
//
// Staleness lives here: every async completion carries the epoch it started
// with and the reducer no-ops when `action.epoch !== state.epoch`, replacing
// the scattered `requestId !== requestIdRef.current` guards. `epoch` bumps on
// every new load/save start and when a load is retired (create mode).

interface EntityFormState<E> {
  value: E | undefined;
  loading: boolean;
  saving: boolean;
  errors: Record<string, string>;
  epoch: number;
}

type EntityFormAction<E> =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; epoch: number; entity: E | undefined }
  | { type: 'LOAD_FAILURE'; epoch: number }
  | { type: 'LOAD_RETIRED' } // netexId removed: abandon in-flight load
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS'; epoch: number; entity: E | undefined }
  | { type: 'SAVE_FAILURE'; epoch: number; fieldErrors: Record<string, string> }
  | { type: 'SAVE_SETTLED' } // release `saving` — deliberately never epoch-gated
  | { type: 'EDIT'; value: E | undefined };

function entityFormReducer<E>(
  state: EntityFormState<E>,
  action: EntityFormAction<E>,
): EntityFormState<E> {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, status: 'loading', epoch: state.epoch + 1 };
    case 'LOAD_SUCCESS':
      if (action.epoch !== state.epoch) return state;
      return { ...state, status: 'idle', value: action.entity, errors: {} };
    case 'LOAD_FAILURE':
      if (action.epoch !== state.epoch) return state;
      return { ...state, status: 'idle', errors: { __init: LOAD_ERR } };
    case 'LOAD_RETIRED':
      // Keep any locally edited value (create mode), just stop waiting on the
      // retired load. Bumping epoch makes its late response a no-op.
      return { ...state, status: 'idle', epoch: state.epoch + 1 };
    case 'SAVE_START':
      return { ...state, status: 'saving', epoch: state.epoch + 1 };
    case 'SAVE_SUCCESS':
      if (action.epoch !== state.epoch) return state;
      return { ...state, value: action.entity, errors: {} };
    case 'SAVE_FAILURE':
      if (action.epoch !== state.epoch) return state;
      return { ...state, errors: action.fieldErrors };
    case 'SAVE_SETTLED':
      // Owns the flag: release it whenever still mounted — gating on epoch
      // leaves it stuck 'saving' if a load bumped the epoch mid-save.
      return state.status === 'saving' ? { ...state, status: 'idle' } : state;
    case 'EDIT':
      return { ...state, value: action.value };
  }
}

const INITIAL_STATE: EntityFormState<any> = {
  value: undefined,
  status: 'idle',
  errors: {},
  epoch: 0,
};

// Internal hook — accepts generic E to type the returned entity shape.
/* eslint-disable @typescript-eslint/no-explicit-any */
export function useEntityForm<E>(props: UseEntityFormProps) {
  const { endpoint, headers, getHeaders, netexId, onSaved, onError } = props;

  const client = useMemo(() => new GraphQLClient(endpoint), [endpoint]);

  const [state, dispatch] = useReducer(
    entityFormReducer<E>,
    INITIAL_STATE as EntityFormState<E>,
  );
  const { value, errors } = state;
  const loading = state.status === 'loading';
  const saving = state.status === 'saving';

  const setValue = useCallback(
    (v: E | undefined) => dispatch({ type: 'EDIT', value: v }),
    [],
  );

  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  // Epoch counter for tagging actions from async closures. Bumped in lockstep
  // with every START/RETIRE dispatch so a closure can capture the epoch it
  // belongs to synchronously. Never gates rendered state — the reducer decides
  // what is stale via its own epoch.
  const epochRef = useRef(0);

  // Keep the config objects in refs so they don't trigger effect re-runs or
  // callback re-creation when the caller passes fresh inline literals each render.
  // The public API contract treats these as stable configuration.
  const fieldsRef = useRef(props.fields);
  const queryRef = useRef(props.query);
  const mutationRef = useRef(props.mutation);
  const headersRef = useRef(headers);
  const getHeadersRef = useRef(getHeaders);
  useEffect(() => { fieldsRef.current = props.fields; }, [props.fields]);
  useEffect(() => { queryRef.current = props.query; }, [props.query]);
  useEffect(() => { mutationRef.current = props.mutation; }, [props.mutation]);
  useEffect(() => { headersRef.current = headers; }, [headers]);
  useEffect(() => { getHeadersRef.current = getHeaders; }, [getHeaders]);

  // Resolve headers (static + dynamic) per request rather than into state.
  // Holding them in state made every inline `headers`/`getHeaders` literal mint a
  // new identity -> new state object -> load effect re-run -> in-progress edits
  // overwritten by the server entity. Resolving on demand also means getHeaders()
  // is re-read on every request, so a refreshed token is picked up.
  const resolveHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const base = headersRef.current ? { ...headersRef.current } : {};
    const getDyn = getHeadersRef.current;
    if (!getDyn) return base;
    try {
      return { ...base, ...(await getDyn()) };
    } catch {
      // Failure to load dynamic headers should not silently block the form.
      // Fall back to static headers; downstream requests will fail visibly.
      return base;
    }
  }, []);

  // Load entity by netexId. Staleness is decided by the reducer via epochs —
  // the closures below just tag their completion with the epoch they started at.
  useEffect(() => {
    // Create mode (netexId omitted): keep any locally edited value, but retire
    // any load still in flight for the previous netexId — otherwise its late
    // response passes the epoch check and repopulates the create form (and
    // `loading` never clears if it never resolves).
    if (!netexId) {
      epochRef.current++;
      if (mounted.current) dispatch({ type: 'LOAD_RETIRED' });
      return;
    }

    const query = queryRef.current;
    const epoch = ++epochRef.current;
    dispatch({ type: 'LOAD_START' });

    resolveHeaders()
      .then(authHeaders => {
        client.setHeaders(authHeaders);
        return client.request(query.document, query.variables(netexId));
      })
      .then((data: any) => {
        if (!mounted.current) return;
        const entity = query.resultPath.reduce((o: any, k: string | number) => o?.[k], data);
        dispatch({ type: 'LOAD_SUCCESS', epoch, entity });
      })
      .catch(_e => {
        if (!mounted.current) return;
        dispatch({ type: 'LOAD_FAILURE', epoch });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, netexId, resolveHeaders]);

  // Save + refetch
  const handleSave = useCallback(async () => {
    if (!value) return;
    const query = queryRef.current;
    const mutation = mutationRef.current;
    const fields = fieldsRef.current;

    const epoch = ++epochRef.current;
    dispatch({ type: 'SAVE_START' });
    try {
      client.setHeaders(await resolveHeaders());
      const input = toInputEntity(value, fields);
      const data: any = await client.request(mutation.document, { input });
      const returnedId: string = mutation.resultPath.reduce((o: any, k: string | number) => o?.[k], data);

      // Guard against concurrent save+netexId changes: abort the refetch if
      // another request (load or save) has started in the meantime.
      if (epoch !== epochRef.current || !mounted.current) return;

      const refreshedData: any = await client.request(query.document, query.variables(returnedId));
      const refreshed = query.resultPath.reduce((o: any, k: string | number) => o?.[k], refreshedData);

      if (mounted.current && epoch === epochRef.current) {
        dispatch({ type: 'SAVE_SUCCESS', epoch, entity: refreshed });
        onSaved?.(returnedId);
      }
    } catch (e) {
      if (mounted.current && epoch === epochRef.current) {
        const { fieldErrors, generalErrors } = normalizeEntityErrors(e, fields);
        dispatch({ type: 'SAVE_FAILURE', epoch, fieldErrors });
        // Transport/unknown errors carry no GraphQL error array — without a
        // fallback the save would fail entirely silently.
        const general =
          generalErrors.length || Object.keys(fieldErrors).length
            ? generalErrors
            : [SAVE_ERR];
        if (general.length) onError?.(general);
      }
    } finally {
      // This save owns the flag, so release it whenever still mounted — gating on
      // epoch leaves it stuck true if a load bumped the epoch mid-save.
      // (With genuinely concurrent saves the older one clears first; acceptable
      // for a single boolean, revisit if concurrent saves become real.)
      if (mounted.current) dispatch({ type: 'SAVE_SETTLED' });
    }
  }, [value, client, resolveHeaders, onSaved, onError]);

  return { value, setValue, loading, saving, errors, handleSave };
}
