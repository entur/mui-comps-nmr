# `useEntityForm` analysis

Honest review of the current hook implementation and a comparison with a React 19
(`use`) shaped design.

## Current hook-only issues (prioritized)

| # | Issue | Why it matters |
|---|-------|----------------|
| H1 | `headers`/`getHeaders` identity churn re-triggers load and wipes edits | Every parent re-render with inline headers restarts auth resolution, which changes `authHeaders`, which re-runs the load effect and calls `setValue(serverEntity)`. |
| H2 | `authHeaders` stored in state couples auth to render lifecycle | We resolve async headers, then pass them into effects, then set them on a mutable client. This creates races. |
| H3 | Manual request-id staleness guarding | Lots of `if (requestId !== requestIdRef.current)` boilerplate. Easy to miss (`onSaved` already is). |
| H4 | Create-mode state cleared whenever `authHeaders` resolves | User typing before headers resolve loses edits. |
| H5 | `onSaved` not staleness-guarded | Could fire for wrong entity. |
| H6 | `saving` stuck if a load bumps `requestId` mid-save | Old save's finally block sees mismatched id and skips `setSaving(false)`. |
| H7 | Error normalization assumes non-standard GraphQL path shape | Per-field errors may not map. |
| H8 | `client.setHeaders` before each request is side-effect-y inside render/closure | Mutating a shared client during render/effects is fragile. |

The root cause of H1, H2, H4, H6 is the same: **we're trying to manage async auth
state and async data state in the same hook with `useEffect` and refs.**

## Current control flow

```mermaid
flowchart TD
    A[mount / props change] --> B{headers / getHeaders changed?}
    B -->|yes| C[resolve auth headers async]
    C --> D[setAuthHeaders state]
    D --> E{netexId && authHeaders?}
    B -->|no| E
    E -->|yes| F[bump requestId<br/>client.setHeaders<br/>setLoading true]
    F --> G[client.request load]
    G -->|success| H{requestId current?}
    H -->|yes| I[setValue + setErrors{}]
    H -->|no| J[ignore stale]
    G -->|error| K{requestId current?}
    K -->|yes| L[setErrors __init]
    K -->|no| J
    G --> I --> M[setLoading false]
    E -->|no netexId| N[clear value/errors]
    E -->|no authHeaders| O[wait]
    P[user clicks Save] --> Q{bump requestId<br/>client.setHeaders<br/>setSaving true}
    Q --> R[mutate]
    R -->|success| S{requestId current?}
    S -->|yes| T[refetch]
    T --> U{requestId current?}
    U -->|yes| V[setValue + setErrors{}]
    U -->|no| W[ignore]
    R -->|error| X{requestId current?}
    X -->|yes| Y[setErrors + onError]
    X -->|no| W
    V --> Z[onSaved]
    Z --> AA[setSaving false]
```

## React 19 replacement shape

React 19 introduces **`use`** — a Hook that reads a Promise or context inside
render. This is a better fit for async auth/data than `useEffect` + `useState`.

```tsx
function useEntityForm<E>(props) {
  // 1. Resolve headers inside render with `use`, if the caller already gives
  //    a promise. Or keep a tiny async hook that returns a promise and `use()` it.

  // 2. Data fetch as a Suspense-compatible resource.
  const entityPromise = useMemo(
    () => (netexId ? fetchEntity(netexId, headers) : Promise.resolve(undefined)),
    [netexId]
  );
  const entity = use(entityPromise); // suspends while loading

  // 3. Save uses a transition/action so UI stays responsive.
  const [saveState, submitSave] = useActionState(async (_, formData) => {
    // mutate + refetch
  }, null);

  return { value: entity ?? localEdits, submitSave, ... };
}
```

## What `use()` fixes

| Current hack | React 19 replacement |
|-------------|----------------------|
| `requestIdRef` staleness guards | `use()` gives a stable resource per `netexId`; old in-flight promises are naturally ignored |
| `authHeaders` state causing re-loads | `use()` a header promise; render suspends until ready |
| `client.setHeaders` side effects | Create a fresh `GraphQLClient` per request with headers inline, or pass headers per `request()` call |
| `mounted` ref | `use()` + Suspense/error boundaries handle unmount |
| `useCallback` + ref-guarded configs | `use()` resources depend on stable props; inline objects don't matter |

## Practical first step without a full rewrite

Even if we don't adopt `use()` today, we can adopt its mental model:

1. **Per-request client**: build a new `GraphQLClient(endpoint, { headers })`
   for each request instead of mutating one.
2. **Single async state machine**: replace the tangle of
   `useEffect`/`useState`/`useRef` with a reducer or small state machine.
3. **Cancel via `AbortController`**: pass a signal to `fetch` (if
   `graphql-request` supports it) or just ignore stale promise results via
   closure.

## Recommendation

The hook is now too complex to patch incrementally. The highest-value move is to
rewrite `useEntityForm` using a React 19-friendly pattern — either `use()`
directly (the library already pins React 19) or a reducer-based state machine
that mirrors it.
