/**
 * Schema downloader (runs before codegen).
 *
 * Fetches the live sobek SDL and writes it to `schema/sobek.schema.graphqls`,
 * which `codegen.ts` then reads. Kept as a separate GET step because the file
 * is served as raw SDL from a static host — graphql-codegen's URL loader does
 * an introspection POST instead, which a static `.graphqls` file can't answer.
 *
 * Canonical schema source (see README): https://entur.github.io/sobek/schema.graphqls
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA_URL = 'https://entur.github.io/sobek/schema.graphqls';
const SCHEMA_PATH = 'schema/sobek.schema.graphqls';

const main = async (): Promise<void> => {
  const res = await fetch(SCHEMA_URL);
  if (!res.ok) throw new Error(`Failed to fetch schema (${res.status}) from ${SCHEMA_URL}`);
  const sdl = await res.text();

  mkdirSync(dirname(SCHEMA_PATH), { recursive: true });
  writeFileSync(SCHEMA_PATH, sdl);
  console.log(`[schema] downloaded ${sdl.length} bytes → ${SCHEMA_PATH}`);
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});
