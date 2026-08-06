# Plan: reducer-based `useEntityForm`

Goal: rewrite `src/EntityDetailsForm/hooks/useEntityForm.ts` around
`useReducer` so the async state machine is explicit and the file shrinks,
while keeping the public API and the existing test suite
(`useEntityForm.test.ts`, 12 tests on `main`) passing **unchanged**.

## Why a reducer (and not `use()` yet)

The analysis (`docs/useEntityForm-analysis.md`) recommends a React 19 `use()`
shape eventually, but lists "a reducer-based state machine that mirrors it"
as an acceptable first step. A reducer:

- collapses the 4 `useState` + `requestIdRef` + `mounted` ref tangle into one
  explicit state machine (H1–H6 all trace back to this);
- keeps renderHook-based tests viable — `use()` + Suspense would require
  wrapping tests in `<Suspense>` and error boundaries, i.e. test changes;
- is a stepping stone: the reducer's actions map 1:1 onto events a future
  `use()` resource would emit.

## Test compatibility constraints (what pins the design)

Reading the current tests, the rewrite must preserve exactly:

| Test | Behavioral contract the reducer must keep |
|---|---|
| loads on mount | `loading` true during fetch; `value` = entity at `resultPath` |
| create mode preserves edits | `netexId → undefined` keeps `value`, does not blank |
| invalidates in-flight load on → create | late response must not repopulate; `loading` clears |
| no netexId → no load | no request issued |
| load failure | `errors = { __init: 'Failed to load' }` |
| async getHeaders merge | dynamic merged over static, awaited per request |
| headers identity churn | no reload, edits preserved (headers never in effect deps) |
| stale response on netexId change | old response ignored |
| load bumps requestId mid-save | `saving` still released (not gated on request id) |
| save w/o GraphQL errors | `onError(['Failed to save'])` fallback |
| save → refetch → onSaved | value replaced by refetched entity, `onSaved(id)` fired |

All of these are observable through the returned
`{ value, setValue, loading, saving, errors, handleSave }` — the internal
machinery is free to change.

## Design

### State

```ts
type State<E> = {
  value: E | undefined;
  status: 'idle' | 'loading' | 'saving';   // one flag, not two booleans
  errors: Record<string, string>;
  epoch: number;                            // replaces requestIdRef
};
```

`loading = status === 'loading'`, `saving = status === 'saving'` — derived in
the return value, so the public shape is identical.

### Actions

```ts
type Action<E> =
  | { type: 'LOAD_START' }                       // bumps epoch
  | { type: 'LOAD_SUCCESS'; epoch: number; entity: E }
  | { type: 'LOAD_FAILURE'; epoch: number }
  | { type: 'LOAD_RETIRED' }                     // netexId removed: epoch++, status → idle
  | { type: 'SAVE_START' }                       // bumps epoch
  | { type: 'SAVE_SUCCESS'; epoch: number; entity: E }
  | { type: 'SAVE_FAILURE'; epoch: number; fieldErrors: Record<string, string> }
  | { type: 'SAVE_SETTLED' }                     // saving → previous status, never epoch-gated
  | { type: 'EDIT'; value: E | undefined };      // replaces setValue passthrough
```

Staleness lives **inside the reducer**: every async completion carries the
epoch it started with and the reducer no-ops if `action.epoch !== state.epoch`.
That deletes all the `if (requestId !== requestIdRef.current)` guards from the
async closures (H3) — there is exactly one staleness check per action type, in
one place.

`SAVE_SETTLED` is deliberately **not** epoch-gated, reproducing the
"release `saving` on mount-check alone" contract the mid-save test pins (H6).

### Effects / structure

Three pieces, replacing the current ~60-line load effect + 50-line save
callback:

1. **Config refs** — unchanged approach (fields/query/mutation/headers in refs,
   updated by small effects). This is what keeps the identity-churn test green
   and stays as-is; it's cheap and correct. Resolve-headers helper unchanged.

2. **One load effect** keyed on `[client, netexId]` only:
   - no `netexId` → `dispatch(LOAD_RETIRED)`;
   - else `dispatch(LOAD_START)`, resolve headers, request, dispatch
     `LOAD_SUCCESS | LOAD_FAILURE` with the captured epoch.
   Epoch is read from a ref mirror of state (or via the functional
   `dispatch` carrying `++epochRef.current`); the ref never gates *rendered*
   state, only tags actions — the reducer decides.

3. **`handleSave`** — same flow as today (mutate → epoch check → refetch →
   `SAVE_SUCCESS` + `onSaved`, catch → `SAVE_FAILURE` + `onError` fallback,
   finally → `SAVE_SETTLED`), but staleness is the reducer's job. `onSaved`
   fires only from the `SAVE_SUCCESS` path, which the reducer has already
   accepted as current — fixing H5 for free. Note: `onSaved` is a side effect,
   so it stays in the closure *after* confirming via a state read that the
   epoch still matches, or is fired from an effect watching a
   `lastSavedId` field in state. **Decision:** keep it in the closure guarded
   by `epochRef.current === epoch` (mirrors current behavior; avoids growing
   state for one callback).

### `mounted` ref

Kept, but only to guard the two flag dispatches (`LOAD_RETIRED`'s
status reset and `SAVE_SETTLED`) and `onSaved`/`onError` callbacks after
unmount — 3 checks instead of the current 7. React 18+ dev StrictMode aside,
dispatching after unmount is a no-op warning-wise, but the callbacks genuinely
need the guard.

## What this fixes / shrinks

| Issue | Outcome |
|---|---|
| H3 request-id boilerplate | single epoch check per action inside reducer |
| H5 `onSaved` unguarded | fires only on accepted `SAVE_SUCCESS` |
| H6 saving stuck | `SAVE_SETTLED` never epoch-gated (test-pinned) |
| H8 `client.setHeaders` mutation | out of scope for this pass — keep per-request `setHeaders` to avoid touching client memoization; per-request client is a follow-up |
| Line count | ~150 → ~110, with the state machine readable top-to-bottom |

H1/H2/H4 are already fixed on `main` (per-request header resolution); the
reducer preserves those fixes by keeping headers out of all dependency arrays.

## Steps

1. Add `State`/`Action` types + `createEntityFormReducer<E>()` above the hook
   (exported? — no; keep module-private, tests are black-box).
2. Replace the 4 `useState` calls with `useReducer`; derive
   `loading`/`saving` in the return object.
3. Rewrite the load effect to dispatch actions; delete inline staleness checks.
4. Rewrite `handleSave` to dispatch; keep `onSaved`/`onError` in the closure
   with an epoch-ref guard.
5. `setValue` passthrough → `dispatch({ type: 'EDIT', value })` wrapped in a
   `useCallback` so identity is stable for consumers.
6. Run `npm run test` — target: all 12 existing tests pass unmodified.
7. Run `npm run typecheck` + lint.
8. If any test fails only due to internal assumptions (none are expected —
   tests mock `graphql-request` and assert on the public tuple), fix the
   implementation, not the test.

## Non-goals (explicitly)

- No `use()`/Suspense migration (future pass; this reducer's actions map onto
  its events).
- No per-request `GraphQLClient` (H8) — separate change.
- No change to error normalization (H7) — separate change.
- No new tests required; adding a reducer unit test is optional and additive.
