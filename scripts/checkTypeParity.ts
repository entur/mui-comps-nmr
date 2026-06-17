/**
 * Read/write type-parity guard (runs before codegen).
 *
 * Sobek's schema carries both `type VehicleType` (object type, returned by
 * reads) and `input VehicleTypeInput` (write payload) — a near-duplicate pair
 * that is a by-product of sobek's Java/GraphQL stack. This library wants to
 * expose ONE TypeScript type (`VehicleType`), so it must verify the two stay
 * close enough to justify that.
 *
 * The guard downloads the live schema, collects the field-name set of each
 * type, and compares them. Known, reviewed divergences are allow-listed:
 * read-only metadata the input doesn't accept, and write-only fields the read
 * type doesn't return. Any divergence OUTSIDE the allow-list means the schema
 * drifted in a way nobody has reviewed — the guard exits non-zero so codegen
 * (and the build) stops until the divergence is understood.
 *
 * Side effect: writes the downloaded SDL to `schema/sobek.schema.graphqls`,
 * which `codegen.ts` then reads — so the schema is fetched exactly once.
 */
import { buildSchema, GraphQLObjectType, GraphQLInputObjectType } from 'graphql';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA_URL = 'https://entur.github.io/sobek/schema.graphqls';
const SCHEMA_PATH = 'schema/sobek.schema.graphqls';
const READ_TYPE = 'VehicleType';
const INPUT_TYPE = 'VehicleTypeInput';

/** Fields present on the read type but legitimately absent from the input. */
const EXPECTED_READ_ONLY = new Set(['vehicles', 'version', 'created', 'changed', 'changedBy']);
/** Fields required on the input but never returned on the read type. */
const EXPECTED_INPUT_ONLY = new Set(['dataOwnerRef']);

const diff = (a: Set<string>, b: Set<string>): string[] => [...a].filter(x => !b.has(x)).sort();

const main = async (): Promise<void> => {
  const res = await fetch(SCHEMA_URL);
  if (!res.ok) throw new Error(`Failed to fetch schema (${res.status}) from ${SCHEMA_URL}`);
  const sdl = await res.text();

  mkdirSync(dirname(SCHEMA_PATH), { recursive: true });
  writeFileSync(SCHEMA_PATH, sdl);

  const schema = buildSchema(sdl);
  const read = schema.getType(READ_TYPE);
  const input = schema.getType(INPUT_TYPE);
  if (!(read instanceof GraphQLObjectType)) throw new Error(`${READ_TYPE} missing or not an object type`);
  if (!(input instanceof GraphQLInputObjectType)) throw new Error(`${INPUT_TYPE} missing or not an input type`);

  const readFields = new Set(Object.keys(read.getFields()));
  const inputFields = new Set(Object.keys(input.getFields()));

  const readOnly = diff(readFields, inputFields); // in read, not input
  const inputOnly = diff(inputFields, readFields); // in input, not read
  const unexpectedReadOnly = readOnly.filter(f => !EXPECTED_READ_ONLY.has(f));
  const unexpectedInputOnly = inputOnly.filter(f => !EXPECTED_INPUT_ONLY.has(f));

  const fmt = (xs: string[]) => (xs.length ? xs.join(', ') : '(none)');
  console.log(`[parity] ${READ_TYPE} ↔ ${INPUT_TYPE}`);
  console.log(`[parity]   read-only fields (expected): ${fmt(readOnly)}`);
  console.log(`[parity]   write-only fields (expected): ${fmt(inputOnly)}`);

  if (readOnly.length === 0 && inputOnly.length === 0) {
    console.log('[parity] ✓ types are identical — single VehicleType is exact.');
    return;
  }
  if (unexpectedReadOnly.length === 0 && unexpectedInputOnly.length === 0) {
    console.log('[parity] ✓ divergence is within the reviewed allow-list — single VehicleType is safe.');
    return;
  }

  console.error('[parity] ✗ UNREVIEWED schema divergence — refusing to collapse to one type.');
  if (unexpectedReadOnly.length) console.error(`[parity]   unexpected read-only: ${fmt(unexpectedReadOnly)}`);
  if (unexpectedInputOnly.length) console.error(`[parity]   unexpected write-only: ${fmt(unexpectedInputOnly)}`);
  console.error('[parity]   Review the change, then update EXPECTED_READ_ONLY / EXPECTED_INPUT_ONLY in scripts/checkTypeParity.ts.');
  process.exit(1);
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});
