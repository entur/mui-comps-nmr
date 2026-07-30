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
  const { fields, query, mutation, endpoint, headers, getHeaders, netexId, onSaved, onError } =
    props;

  const client = useMemo(() => new GraphQLClient(endpoint), [endpoint]);

  const [value, setValue] = useState<E | undefined>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  // Apply headers (static + dynamic)
  useEffect(() => {
    const h = headers ? { ...headers } : {};
    if (getHeaders) {
      Promise.resolve(getHeaders()).then(dyn => client.setHeaders({ ...h, ...dyn }));
    } else {
      client.setHeaders(h);
    }
  }, [client, headers, getHeaders]);

  // Load entity by netexId
  useEffect(() => {
    if (!netexId) {
      if (mounted.current) setValue(undefined);
      return;
    }
    setLoading(true);
    client
      .request(query.document, query.variables(netexId))
      .then((data: any) => {
        if (!mounted.current) return;
        const entity = query.resultPath.reduce((o: any, k: string | number) => o?.[k], data);
        setValue(entity);
        setErrors({});
      })
      .catch(_e => {
        if (!mounted.current) return;
        setErrors({ __init: 'Failed to load' });
      })
      .finally(() => {
        if (mounted.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, netexId]);

  // Save + refetch
  const handleSave = useCallback(async () => {
    if (!value) return;
    setSaving(true);
    try {
      const input = toInputEntity(value, fields);
      const data: any = await client.request(mutation.document, { input });
      const returnedId: string = mutation.resultPath.reduce((o: any, k: string | number) => o?.[k], data);

      const refreshedData: any = await client.request(query.document, query.variables(returnedId));
      const refreshed = query.resultPath.reduce((o: any, k: string | number) => o?.[k], refreshedData);
      if (mounted.current) {
        setValue(refreshed);
        setErrors({});
      }
      onSaved?.(returnedId);
    } catch (e) {
      if (mounted.current) {
        const { fieldErrors, generalErrors } = normalizeEntityErrors(e, fields);
        setErrors(fieldErrors);
        if (generalErrors.length) onError?.(generalErrors);
      }
    } finally {
      if (mounted.current) setSaving(false);
    }
  }, [value, client, fields, query, mutation, onSaved, onError]);

  return { value, setValue, loading, saving, errors, handleSave };
}
