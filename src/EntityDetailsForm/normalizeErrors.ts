import type { FieldSpec } from './types';

export function normalizeEntityErrors(
  error: unknown,
  fields: Record<string, FieldSpec>
): { fieldErrors: Record<string, string>; generalErrors: string[] } {
  const fieldErrors: Record<string, string> = {};
  const generalErrors: string[] = [];
  const errs = (error as any)?.response?.errors ?? [];

  for (const err of errs) {
    const path: Array<string | number> = err.path ?? [];
    const idx = path.indexOf('input');
    const inputPath = idx >= 0 ? path.slice(idx + 1).filter((p): p is string => typeof p === 'string') : [];

    const fieldKey = Object.entries(fields).find(([, spec]) => {
      if (spec.serverManaged || spec.locked) return false;
      return spec.path.join('.') === inputPath.join('.');
    })?.[0];

    if (fieldKey) {
      fieldErrors[fieldKey] = err.message;
    } else {
      generalErrors.push(err.message);
    }
  }
  return { fieldErrors, generalErrors };
}
