/**
 * A tiny in-browser stand-in for the sobek GraphQL endpoint, so the *data-aware*
 * `VehicleForm` (which really `fetch`es) can run inside Storybook with no server.
 *
 * Iteration 1 is intentionally static: reads are answered from a seed map, and
 * the save mutation just echoes the id back — nothing is written, so a refetch
 * after save returns the original record. Later iterations can make the store
 * mutable (persist saves) or swap this for MSW.
 *
 * It patches `window.fetch` once (idempotent) and only intercepts requests to
 * {@link MOCK_ENDPOINT}; every other URL passes through to the real `fetch`.
 */
import type { Vehicle } from "../index";

/** The URL to hand the form as its `endpoint`; only these calls are mocked. */
export const MOCK_ENDPOINT = "https://mock.local/graphql";

/** New-record placeholder id returned when a create mutation has no `netexId`. */
const NEW_ID = "VEH:Vehicle:NEW";

/** Read-side store: `netexId` → entity. */
type Seed = Record<string, Vehicle>;

/** Marker so the patch is installed at most once per session. */
const PATCHED = Symbol.for("mui-comps-nmr.mockFetch");

/** Extract a string URL from any `fetch` first-arg form. */
const urlOf = (input: RequestInfo | URL): string =>
  typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

/** 200 JSON response wrapping `data` in the GraphQL `{ data }` envelope. */
const gql = (data: unknown): Response =>
  new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

/**
 * Install the mock `fetch` for {@link MOCK_ENDPOINT}, backed by `seed`. Safe to
 * call from module scope and more than once — later calls just refresh the seed.
 *
 * Routing is by variable shape (no query-string parsing): `{ input }` → the
 * `createOrUpdateVehicle` mutation; `{ filter }` → the `GetVehicle` query.
 *
 * @param seed Read-side records keyed by `netexId`.
 */
export function installMockVehicleFetch(seed: Seed): void {
  const w = window as typeof window & { [PATCHED]?: { seed: Seed } };
  if (w[PATCHED]) {
    w[PATCHED].seed = seed;
    return;
  }
  const ctx = { seed };
  w[PATCHED] = ctx;

  const real = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!urlOf(input).startsWith(MOCK_ENDPOINT)) return real(input, init);

    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const vars = (body.variables ?? {}) as {
      input?: { netexId?: string };
      filter?: { netexIds?: string[] };
    };

    // Mutation: echo the incoming id (or a new-record placeholder). No write.
    if (vars.input) {
      return gql({ createOrUpdateVehicle: vars.input.netexId ?? NEW_ID });
    }

    // Query: look the record up by its first requested netexId.
    const netexId = vars.filter?.netexIds?.[0];
    const entity = netexId ? ctx.seed[netexId] : undefined;
    return gql({ vehicles: { content: entity ? [entity] : [] } });
  };
}
