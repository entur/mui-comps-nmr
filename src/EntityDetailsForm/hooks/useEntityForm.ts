import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { GraphQLClient } from 'graphql-request';
import type { FieldSpec } from '../types';
import { toInputEntity } from '../toInput';
import { normalizeEntityErrors } from '../normalizeErrors';
import type { TypedDocumentNode } from '@graphql-typed-document-node/core';

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

// Internal hook — accepts generic E to type the returned entity shape.
/* eslint-disable @typescript-eslint/no-explicit-any */
export function useEntityForm<E>(props: UseEntityFormProps) {
  const { endpoint, headers, getHeaders, netexId, onSaved, onError } = props;

  const client = useMemo(() => new GraphQLClient(endpoint), [endpoint]);

  const [value, setValue] = useState<E | undefined>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Resolved headers: static headers merged with the latest result of getHeaders().
  // Load/save effects wait for this to be non-null before issuing requests, so
  // dynamic auth headers (e.g. Authorization) are never omitted on the first request.
  const [authHeaders, setAuthHeaders] = useState<Record<string, string> | null>(null);

  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const requestIdRef = useRef(0);

  // Keep the config objects in refs so they don't trigger effect re-runs or
  // callback re-creation when the caller passes fresh inline literals each render.
  // The public API contract treats these as stable configuration.
  const fieldsRef = useRef(props.fields);
  const queryRef = useRef(props.query);
  const mutationRef = useRef(props.mutation);
  useEffect(() => { fieldsRef.current = props.fields; }, [props.fields]);
  useEffect(() => { queryRef.current = props.query; }, [props.query]);
  useEffect(() => { mutationRef.current = props.mutation; }, [props.mutation]);

  // Resolve headers (static + dynamic) whenever the inputs change.
  useEffect(() => {
    let cancelled = false;
    const base = headers ? { ...headers } : {};

    if (!getHeaders) {
      setAuthHeaders(base);
      return;
    }

    Promise.resolve(getHeaders())
      .then(dyn => {
        if (!cancelled) setAuthHeaders({ ...base, ...dyn });
      })
      .catch(() => {
        // Failure to load dynamic headers should not silently block the form.
        // Fall back to static headers; downstream requests will fail visibly.
        if (!cancelled) setAuthHeaders(base);
      });

    return () => { cancelled = true; };
  }, [headers, getHeaders]);

  // Load entity by netexId once auth headers are resolved.
  useEffect(() => {
    // Create mode (netexId omitted): keep any locally edited value; don't clear it
    // just because auth headers are still resolving.
    if (!netexId) return;

    if (!authHeaders) {
      // Clear stale state while auth headers are still resolving for an edit form.
      if (mounted.current) {
        setValue(undefined);
        setErrors({});
      }
      return;
    }

    const requestId = ++requestIdRef.current;
    const query = queryRef.current;
    client.setHeaders(authHeaders);
    setLoading(true);

    client
      .request(query.document, query.variables(netexId))
      .then((data: any) => {
        if (!mounted.current || requestId !== requestIdRef.current) return;
        const entity = query.resultPath.reduce((o: any, k: string | number) => o?.[k], data);
        setValue(entity);
        setErrors({});
      })
      .catch(_e => {
        if (!mounted.current || requestId !== requestIdRef.current) return;
        setErrors({ __init: 'Failed to load' });
      })
      .finally(() => {
        if (mounted.current && requestId === requestIdRef.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, netexId, authHeaders]);

  // Save + refetch
  const handleSave = useCallback(async () => {
    if (!value || !authHeaders) return;
    const requestId = ++requestIdRef.current;
    const query = queryRef.current;
    const mutation = mutationRef.current;
    const fields = fieldsRef.current;

    client.setHeaders(authHeaders);
    setSaving(true);
    try {
      const input = toInputEntity(value, fields);
      const data: any = await client.request(mutation.document, { input });
      const returnedId: string = mutation.resultPath.reduce((o: any, k: string | number) => o?.[k], data);

      // Guard against concurrent save+netexId changes: abort the refetch if
      // another request (load or save) has started in the meantime.
      if (requestId !== requestIdRef.current || !mounted.current) return;

      const refreshedData: any = await client.request(query.document, query.variables(returnedId));
      const refreshed = query.resultPath.reduce((o: any, k: string | number) => o?.[k], refreshedData);

      if (mounted.current && requestId === requestIdRef.current) {
        setValue(refreshed);
        setErrors({});
        onSaved?.(returnedId);
      }
    } catch (e) {
      if (mounted.current && requestId === requestIdRef.current) {
        const { fieldErrors, generalErrors } = normalizeEntityErrors(e, fields);
        setErrors(fieldErrors);
        if (generalErrors.length) onError?.(generalErrors);
      }
    } finally {
      if (mounted.current && requestId === requestIdRef.current) setSaving(false);
    }
  }, [value, client, authHeaders, onSaved, onError]);

  return { value, setValue, loading, saving, errors, handleSave };
}
