/**
 * Immutable read/write of a value by access path (the `path` carried by each
 * `FieldSpec`). `setPath` collapses an all-empty nested object back to
 * `undefined` so cleared value-objects don't linger as `{}` and read as dirty.
 */

type Obj = Record<string, unknown>;

/** Read the value at `path`; `undefined` if any segment is missing. */
export const getPath = (obj: unknown, path: readonly string[]): unknown =>
  path.reduce<unknown>((o, k) => (o == null ? undefined : (o as Obj)[k]), obj);

/** True when every own value is null/undefined. */
const allEmpty = (o: Obj): boolean => Object.values(o).every(v => v == null);

/** Set `path` to `val` immutably; prune the touched branch if it goes all-empty. */
export const setPath = (obj: unknown, path: readonly string[], val: unknown): Obj => {
  const root: Obj = { ...((obj as Obj) ?? {}) };
  const [head, ...rest] = path;
  const next = rest.length === 0 ? val : setPath(root[head], rest, val);
  // Collapse a plain (non-array) child object that no longer holds any value.
  const pruned =
    rest.length > 0 &&
    next &&
    typeof next === 'object' &&
    !Array.isArray(next) &&
    allEmpty(next as Obj)
      ? undefined
      : next;
  root[head] = pruned;
  return root;
};
