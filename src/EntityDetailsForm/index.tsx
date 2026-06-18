import { useState, type FC, type ReactNode } from 'react';
import { Box, Stack, Tab, Tabs, Typography } from '@mui/material';
import type { EntityDetailsFormProps, FieldEntry, FieldSpec, Layout, LayoutItem } from './types';
import { getPath, setPath } from './paths';
import { humanize } from './humanize';
import { renderControl } from './controls';

/** A field resolved for rendering: its registry key, display label, and (for a
 *  grid) the optional explicit column entries from the layout. */
interface ResolvedField {
  key: string;
  label: string;
  cols?: FieldEntry[];
}
interface Section {
  label: string;
  fields: ResolvedField[];
}

/** Normalize a `LayoutItem` to `{ field, label?, entries? }`. */
const norm = (item: LayoutItem): { field: string; label?: string; entries?: FieldEntry[] } =>
  typeof item === 'string'
    ? { field: item }
    : { field: item.field, label: item.label, entries: item.entries };

/**
 * Resolve the section structure from the whitelist `layout`. Omitted layout →
 * one flat section of all registry fields. Unknown keys and duplicates are
 * dropped. No auto-append: a field absent from the layout simply doesn't render.
 */
function resolveSections(fields: Record<string, FieldSpec>, layout?: Layout): Section[] {
  if (!layout) {
    return [{ label: '', fields: Object.keys(fields).map(key => ({ key, label: humanize(key) })) }];
  }
  const seen = new Set<string>();
  return Object.entries(layout).map(([label, items]) => ({
    label,
    fields: items
      .map(norm)
      .filter(e => fields[e.field] && !seen.has(e.field) && (seen.add(e.field), true))
      .map(e => ({ key: e.field, label: e.label ?? humanize(e.field), cols: e.entries })),
  }));
}

/**
 * Build a presentational entity form bound to a generated `FIELDS` registry.
 * The returned component is named by the client.
 *
 * @param fields The entity's flat `FIELDS` registry (from `src/entities/*`).
 * @returns A React component taking `value` / `onChange` / `mode` / `layout` / `variant`.
 */
export function createEntityDetailsForm<E>(
  fields: Record<string, FieldSpec>
): FC<EntityDetailsFormProps<E>> {
  const Form: FC<EntityDetailsFormProps<E>> = ({
    value,
    onChange,
    mode,
    layout,
    variant = 'tabs',
  }) => {
    const [active, setActive] = useState(0);
    // Drop sections left empty by unknown-only keys; clamp the active index so a
    // shrinking layout can't point past the end and render a blank panel.
    const sections = resolveSections(fields, layout).filter(s => s.fields.length > 0);
    const current = Math.min(active, Math.max(0, sections.length - 1));

    // `arr` is the section's field list (3rd map arg) — used to tell a grid
    // whether it is alone in its section.
    const field = ({ key, label, cols }: ResolvedField, _i: number, arr: ResolvedField[]): ReactNode => {
      const spec = fields[key];
      const disabled = mode === 'view' || !!spec.serverManaged;
      const control = renderControl({
        spec,
        label,
        value: getPath(value, spec.path),
        disabled,
        onChange: next => onChange(setPath(value, spec.path, next) as E),
        // Alone in its section → the tab/heading names it; a grid then draws no
        // label. Beside other fields → the grid shows its own label to disambiguate.
        solo: arr.length <= 1,
        // Grid column order/labels from the layout entry's `entries` (if any).
        cols,
      });
      return (
        <Box key={key} sx={{ mb: 2 }}>
          {control}
        </Box>
      );
    };

    // Flat: one section → no tab bar, no heading.
    if (sections.length < 2) {
      return <Box>{sections[0]?.fields.map(field)}</Box>;
    }

    // Stacked: every section's panel in one container, each under its label.
    if (variant === 'stacked') {
      return (
        <Stack spacing={3}>
          {sections.map(s => (
            <Box key={s.label}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {s.label}
              </Typography>
              {s.fields.map(field)}
            </Box>
          ))}
        </Stack>
      );
    }

    // Tabs: one section visible at a time.
    return (
      <Box>
        <Tabs value={current} onChange={(_e, v: number) => setActive(v)} sx={{ mb: 2 }}>
          {sections.map(s => (
            <Tab key={s.label} label={s.label} />
          ))}
        </Tabs>
        {sections[current]?.fields.map(field)}
      </Box>
    );
  };
  Form.displayName = 'EntityDetailsForm';
  return Form;
}
