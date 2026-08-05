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

  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const requestIdRef = useRef(0);

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

  // Load entity by netexId.
  useEffect(() => {
    // Create mode (netexId omitted): keep any locally edited value.
    if (!netexId) return;

    const requestId = ++requestIdRef.current;
    const query = queryRef.current;
    setLoading(true);

    resolveHeaders()
      .then(authHeaders => {
        client.setHeaders(authHeaders);
        return client.request(query.document, query.variables(netexId));
      })
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
  }, [client, netexId, resolveHeaders]);

  // Save + refetch
  const handleSave = useCallback(async () => {
    if (!value) return;
    const requestId = ++requestIdRef.current;
    const query = queryRef.current;
    const mutation = mutationRef.current;
    const fields = fieldsRef.current;

    setSaving(true);
    try {
      client.setHeaders(await resolveHeaders());
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
  }, [value, client, resolveHeaders, onSaved, onError]);

  return { value, setValue, loading, saving, errors, handleSave };
}
