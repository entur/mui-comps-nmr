/**
 * `SobekProvider` — ambient session inputs for every data-aware component in
 * this library.
 *
 * The provider is **mandatory**: `useSobekCtx()` throws when no provider is
 * above. `endpoint` / `headers` / `getHeaders` / `dataOwnerRef` were removed
 * from the generated wrapper props in favour of this single source of truth.
 */
import { createContext, useContext } from 'react';

export interface SobekCtx {
  /** GraphQL endpoint of the sobek instance. */
  endpoint: string;
  /** Static headers sent with every request. */
  headers?: Record<string, string>;
  /** Dynamic headers, resolved per request (wins over `headers`). */
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
  /** Tenant discriminator, e.g. `NOG:Authority:cP4aPiJ7c39`. Plain string —
   *  the library has no knowledge of the host's Organisation shape. */
  dataOwnerRef: string;
}

const SobekContext = createContext<SobekCtx | undefined>(undefined);

export const SobekProvider = SobekContext.Provider;

export function useSobekCtx(): SobekCtx {
  const ctx = useContext(SobekContext);
  if (ctx === undefined) {
    throw new Error(
      'mui-comps-nmr: this component must be rendered inside a <SobekProvider>'
    );
  }
  return ctx;
}
