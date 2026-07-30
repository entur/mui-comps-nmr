import type { FieldSpec } from './types';

export function normalizeEntityErrors(
  error: unknown,
  fields: Record<string, FieldSpec>
): { fieldErrors: Record<string, string>; generalErrors: string[] } {
  const fieldErrors: Record<string, string> = {};
  const generalErrors: string[] = [];
  const errs = (error as any)?.response?.errors ?? [];

  for (const err of errs) {
    const path: string[] = err.path ?? [];
    const idx = path.indexOf('input');
    const key = idx >= 0 ? path[idx + 1] : undefined;

    if (key && key in fields && !fields[key].serverManaged) {
      fieldErrors[key] = err.message;
    } else {
      generalErrors.push(err.message);
    }
  }
  return { fieldErrors, generalErrors };
}
