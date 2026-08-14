import { useReducer, useEffect, useMemo, useCallback, useRef } from 'react';
import { GraphQLClient } from 'graphql-request';
import { useSobekCtx } from '../../context/SobekContext';
import type { FieldSpec } from '../types';
import { toInputEntity } from '../utils/toInput';
import { reduceToSobekInput } from '../utils/reduceToSobekInput';
import { normalizeEntityErrors } from '../utils/normalizeErrors';
import { isDirty } from '../utils/dirty';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';

// Last-resort messages for failures that yield no usable message (transport
// errors, malformed responses, an empty `errors` array). Whenever the server
// does send messages they win, on both halves — these only fill the silence,
// and when they do they reach the host through `onError`. Note that `onError`
// carries *general* errors only: a save rejected purely on field validation
// routes to `errors` for inline display and fires no callback.
const LOAD_ERR = 'Failed to load', SAVE_ERR = 'Failed to save';

// Registry key of the tenant discriminator. Stamped onto the write payload only
// when the entity actually carries it as a `locked` field (see handleSave).
const OWNER_FIELD = 'dataOwnerRef';

export interface EntityFormConfig {
  fields: Record<string, FieldSpec>;
  query: {
    document: TypedDocumentNode<any, any>;
    variables: (netexId: string, dataOwnerRef: string) => unknown;
    resultPath: readonly (string | number)[];
  };
  mutation: {
    document: TypedDocumentNode<any, any>;
    resultPath: readonly (string | number)[];
    /** Generated wire-key mask for `<Entity>Input` — see `reduceToSobekInput`. */
    inputKeys: Record<string, unknown>;
  };
}

export interface UseEntityFormProps extends EntityFormConfig {
  netexId?: string;
  onSaved?: (netexId: string) => void;
  onError?: (generalErrors: string[]) => void;
  /**
   * Every change to the form's entity, including the initial load and the
   * post-save refetch — not just user edits. Read-only observation: the hook
   * stays the source of truth, so feeding the value back in as a prop is not
   * supported. Use `onDirtyChange` to detect *edits*.
   */
  onChange?: (value: any) => void;
  /**
   * Fired when the form crosses between clean and dirty. The baseline is the
   * entity the server last handed back (load or post-save refetch), compared
   * under the empty-ish rule in `../dirty`.
   */
  onDirtyChange?: (dirty: boolean) => void;
}

// --- Reducer: explicit async state machine -----------------------------
//
// Staleness lives here: every async completion carries the epoch it started
// with and the reducer no-ops when `action.epoch !== state.epoch`, replacing
// the scattered `requestId !== requestIdRef.current` guards. `epoch` bumps on
// every new load/save start and when a load is retired (create mode).

interface EntityFormState<E> {
  value: E | undefined;
  /** Server's last word on this entity — what `value` is diffed against. */
  baseline: E | undefined;
  loading: boolean;
  saving: boolean;
  errors: Record<string, string>;
  epoch: number;
  // Settled-ness of the load, distinct from `loading`. `loading` is false on the
  // first commit (LOAD_START only fires from a passive effect), so it cannot tell
  // "not started yet" from "settled with zero rows" — consumers rendering a
  // not-found state must gate on this instead. 'error' also stays distinct from
  // 'ok' so a failed load is never reported as a missing record.
  load: LoadPhase;
}

type LoadPhase = 'idle' | 'pending' | 'ok' | 'error';

type EntityFormAction<E> =
  | { type: 'LOAD_START' }
  | { type: 'LOAD_SUCCESS'; epoch: number; entity: E | undefined }
  | { type: 'LOAD_FAILURE'; epoch: number; message: string }
  | { type: 'LOAD_RETIRED' } // netexId removed: abandon in-flight load
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS'; epoch: number; entity: E | undefined }
  | { type: 'SAVE_FAILURE'; epoch: number; fieldErrors: Record<string, string> }
  | { type: 'SAVE_SETTLED' } // release `saving` — deliberately never epoch-gated
  | { type: 'EDIT'; value: E | undefined }
  | { type: 'RESET' }; // discard edits: value ← baseline

function entityFormReducer<E>(
  state: EntityFormState<E>,
  action: EntityFormAction<E>,
): EntityFormState<E> {
  switch (action.type) {
    case 'LOAD_START':
      return { ...state, loading: true, load: 'pending', epoch: state.epoch + 1 };
    case 'LOAD_SUCCESS':
      if (action.epoch !== state.epoch) return state;
      return { ...state, loading: false, load: 'ok', value: action.entity, baseline: action.entity, errors: {} };
    case 'LOAD_FAILURE':
      if (action.epoch !== state.epoch) return state;
      return { ...state, loading: false, load: 'error', errors: { __init: action.message } };
    case 'LOAD_RETIRED':
      // Keep any locally edited value (create mode), just stop waiting on the
      // retired load. Bumping epoch makes its late response a no-op. Must not
      // touch `saving` — an in-flight mutation outlives the load it raced.
      return { ...state, loading: false, load: 'idle', epoch: state.epoch + 1 };
    case 'SAVE_START':
      return { ...state, saving: true, epoch: state.epoch + 1 };
    case 'SAVE_SUCCESS':
      if (action.epoch !== state.epoch) return state;
      return { ...state, value: action.entity, baseline: action.entity, errors: {} };
    case 'SAVE_FAILURE':
      if (action.epoch !== state.epoch) return state;
      return { ...state, errors: action.fieldErrors };
    case 'SAVE_SETTLED':
      // This save owns the flag: release it whenever still mounted. Never
      // gated on epoch *or* on a status enum — a load racing the save must
      // not be able to strand or steal it.
      return { ...state, saving: false };
    case 'EDIT':
      return { ...state, value: action.value };
    case 'RESET': {
      // Local discard — no epoch bump and no request: the baseline is already
      // the server's last word, so a refetch would only re-fetch what we hold.
      // Errors go with the edits that caused them, except `__init`: a *re*load
      // (netexId switch, org switch) fails without clearing the entity already
      // on screen, so a load error can coexist with an editable value. It
      // describes the record, not the edit session, and `load` stays 'error'
      // with consumers rendering that message — dropping it here would leave
      // them rendering an empty error.
      const { __init } = state.errors;
      return { ...state, value: state.baseline, errors: __init ? { __init } : {} };
    }
  }
}

const INITIAL_STATE: EntityFormState<any> = {
  value: undefined,
  baseline: undefined,
  loading: false,
  saving: false,
  errors: {},
  epoch: 0,
  load: 'idle',
};

// Internal hook — accepts generic E to type the returned entity shape.
/* eslint-disable @typescript-eslint/no-explicit-any */
export function useEntityForm<E>(props: UseEntityFormProps) {
  const { netexId, onSaved, onError, onChange, onDirtyChange } = props;
  // Ambient session inputs from the provider — the hook requires it (the
  // throw is intended). `dataOwnerRef` joins the load-effect deps below (an
  // org switch must re-fire every mounted load); `headers`/`getHeaders` stay
  // ref-guarded so provider re-renders never clobber in-flight edits.
  const { endpoint, headers, getHeaders, dataOwnerRef } = useSobekCtx();

  const client = useMemo(() => new GraphQLClient(endpoint), [endpoint]);

  const [state, dispatch] = useReducer(
    entityFormReducer<E>,
    INITIAL_STATE as EntityFormState<E>,
  );
  const { value, baseline, errors, loading, saving, load } = state;
  const dirty = useMemo(() => isDirty(value, baseline), [value, baseline]);

  const setValue = useCallback(
    (v: E | undefined) => dispatch({ type: 'EDIT', value: v }),
    [],
  );

  // Cancel an edit session in place. The alternative hosts use today — remount
  // the form under a new `key` — throws away the loaded entity and re-fetches
  // it; this restores the baseline the hook already holds.
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  const mounted = useRef(true);
useEffect(() => {
  mounted.current = true;
  return () => { mounted.current = false; };
}, []);

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
  // Same reasoning for `onError`, which the load effect below calls: a host
  // passing an inline arrow would otherwise put a fresh identity in the effect's
  // deps every render and re-fire the load. `handleSave` reads it from props
  // directly — a callback, not an effect, so re-creating it is harmless.
  const onErrorRef = useRef(onError);
  useEffect(() => { fieldsRef.current = props.fields; }, [props.fields]);
  useEffect(() => { queryRef.current = props.query; }, [props.query]);
  useEffect(() => { mutationRef.current = props.mutation; }, [props.mutation]);
  useEffect(() => { headersRef.current = headers; }, [headers]);
  useEffect(() => { getHeadersRef.current = getHeaders; }, [getHeaders]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  // Same ref treatment for the observation callbacks: they fire from effects
  // below, so an inline host arrow in the deps would re-fire on every render.
  const onChangeRef = useRef(onChange);
  const onDirtyChangeRef = useRef(onDirtyChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onDirtyChangeRef.current = onDirtyChange; }, [onDirtyChange]);

  // Report value/dirty transitions to the host. Both guard on the previous
  // value so a re-render that did not move the form stays silent, and neither
  // fires on mount (both start at the state they are initialised to).
  const prevValue = useRef(value);
  useEffect(() => {
    if (prevValue.current === value) return;
    prevValue.current = value;
    onChangeRef.current?.(value);
  }, [value]);

  const prevDirty = useRef(dirty);
  useEffect(() => {
    if (prevDirty.current === dirty) return;
    prevDirty.current = dirty;
    onDirtyChangeRef.current?.(dirty);
  }, [dirty]);

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
      if (mounted.current) {
        epochRef.current++;
        dispatch({ type: 'LOAD_RETIRED' });
      }
      return;
    }

    const query = queryRef.current;
    const epoch = ++epochRef.current;
    dispatch({ type: 'LOAD_START' });

    resolveHeaders()
      .then(authHeaders => {
        client.setHeaders(authHeaders);
        return client.request(query.document, query.variables(netexId, dataOwnerRef));
      })
      .then((data: any) => {
        if (!mounted.current) return;
        const entity = query.resultPath.reduce((o: any, k: string | number) => o?.[k], data);
        dispatch({ type: 'LOAD_SUCCESS', epoch, entity });
      })
      .catch(e => {
        // Unlike the dispatches above, the epoch check here is not redundant
        // with the reducer's: `onError` is a call into host code and has no
        // reducer to discard it. Without the guard a load retired by
        // LOAD_RETIRED (netexId cleared) or superseded by a newer one still
        // pops an error for a form that has already moved on.
        if (!mounted.current || epoch !== epochRef.current) return;
        // Empty registry by design: the query takes a netexId, not an `input`,
        // so there are no field paths to route to and every message is general.
        // Passing the real `fields` would happen to work today (a query error's
        // path has no 'input' segment) but would be relying on an accident.
        const { generalErrors } = normalizeEntityErrors(e, {});
        const general = generalErrors.length ? generalErrors : [LOAD_ERR];
        // `__init` is one string (it renders as one line); the host gets them
        // unjoined so it can localize or triage per message.
        dispatch({ type: 'LOAD_FAILURE', epoch, message: general.join('; ') });
        onErrorRef.current?.(general);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, netexId, resolveHeaders, dataOwnerRef]);

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
      // dataOwnerRef is stamped from context at the wire edge, never sourced
      // from form state — a value loaded under one org must never be written
      // back under another. Driven by the registry, not by the key: an entity
      // whose Input has no dataOwnerRef (or where distill derived it as
      // serverManaged) must not get one, or every save fails validation.
      // `fields` is distilled from the patched schema, so it can yield keys the
      // live schema has never heard of; the mask is read from the live schema
      // and drops them here, at the wire edge, leaving the form model intact.
      const writable = reduceToSobekInput(toInputEntity(value, fields), mutation.inputKeys);
      const input = fields[OWNER_FIELD]?.locked
        ? { ...writable, [OWNER_FIELD]: dataOwnerRef }
        : writable;
      const data: any = await client.request(mutation.document, { input });
      const returnedId: string = mutation.resultPath.reduce((o: any, k: string | number) => o?.[k], data);

      // Guard against concurrent save+netexId changes: abort the refetch if
      // another request (load or save) has started in the meantime.
      if (epoch !== epochRef.current || !mounted.current) return;

      const refreshedData: any = await client.request(
        query.document,
        query.variables(returnedId, dataOwnerRef)
      );
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
  }, [value, client, resolveHeaders, dataOwnerRef, onSaved, onError]);

  return { value, setValue, reset, loading, saving, load, dirty, errors, handleSave };
}
