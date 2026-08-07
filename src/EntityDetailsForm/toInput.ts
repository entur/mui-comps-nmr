import { getPath, setPath } from './paths';
import type { FieldSpec } from './types';

/**
 * Build an Input-like object from an entity by reading every non-serverManaged
 * FIELDS entry. For `reference` fields the entity already stores the correct
 * `{ netexId }` shape at the parent path, so we copy the parent object.
 * All other fields use their FIELDS path as-is. Empty nested objects are
 * pruned back to `undefined`.
 */
export function toInputEntity<E>(
  entity: E,
  fields: Record<string, FieldSpec>
): Record<string, unknown> {
  let input: Record<string, unknown> = {};

  for (const [, spec] of Object.entries(fields)) {
    if (spec.serverManaged || spec.locked) continue;

    if (spec.kind === 'reference') {
      const parentPath = spec.path.slice(0, -1);
      if (parentPath.length === 0) continue;
      const val = getPath(entity, parentPath);
      if (val != null) {
        input = setPath(input, parentPath, val as Record<string, unknown>);
      }
    } else {
      const val = getPath(entity, spec.path);
      if (val != null) {
        input = setPath(input, spec.path, val as unknown);
      }
    }
  }

  return pruneEmpty(input);
}

/** Recursively strip all-empty branches. */
function pruneEmpty(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue;
    if (typeof v === 'object' && !Array.isArray(v)) {
      const pruned = pruneEmpty(v as Record<string, unknown>);
      if (Object.keys(pruned).length > 0) {
        out[k] = pruned;
      }
    } else {
      out[k] = v;
    }
  }
  return out;
}
