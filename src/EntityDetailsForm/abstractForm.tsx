import { useState, type FC, type ReactNode } from 'react';
import { Box, Stack, Tab, Tabs, Typography } from '@mui/material';
import type {
  EntityDetailsFormProps,
  FieldEntry,
  FieldSpec,
  Layout,
  LayoutItem,
  RefOption,
} from './types';
import { getPath, setPath } from './paths';
import { humanize } from '../shared/humanize';
import { renderControl } from './controls';
import { ObjectGrid } from '../ObjectGrid';

/** A field resolved for rendering: its registry key, display label, the optional
 *  explicit grid column entries, and (for a `reference`) the option-dataset
 *  closure — both from the layout. */
interface ResolvedField {
  key: string;
  label: string;
  cols?: FieldEntry[];
  options?: () => RefOption[];
}
interface Section {
  label: string;
  fields: ResolvedField[];
}

/** Normalize a `LayoutItem` to `{ field, label?, entries?, options? }`. */
const norm = (
  item: LayoutItem
): { field: string; label?: string; entries?: FieldEntry[]; options?: () => RefOption[] } =>
  typeof item === 'string'
    ? { field: item }
    : { field: item.field, label: item.label, entries: item.entries, options: item.options };

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
      .map(e => ({
        key: e.field,
        label: e.label ?? humanize(e.field),
        cols: e.entries,
        options: e.options,
      })),
  }));
}

/**
 * Build a presentational (dumb) entity form bound to a generated `FIELDS`
 * registry. Zero data fetching, zero state management — the host provides
 * `value`, `onChange`, and optional `errors` / `disabled`.
 */
export function createAbstractEntityDetailsForm<E>(
  fields: Record<string, FieldSpec>
): FC<EntityDetailsFormProps<E>> {
  const Form: FC<EntityDetailsFormProps<E>> = ({
    value,
    onChange,
    mode,
    layout,
    variant = 'tabs',
    slotProps,
    errors,
    disabled: disabledProp,
  }) => {
    const [active, setActive] = useState(0);
    const sections = resolveSections(fields, layout).filter(s => s.fields.length > 0);
    const current = Math.min(active, Math.max(0, sections.length - 1));

    const field = (
      { key, label, cols, options }: ResolvedField,
      _i: number,
      arr: ResolvedField[]
    ): ReactNode => {
      const spec = fields[key];

      if (spec.kind === 'grid') {
        return (
          <Box key={key} sx={{ mb: 2 }}>
            <ObjectGrid
              rows={getPath(value, spec.path)}
              label={label}
              showLabel={arr.length > 1}
              cols={cols}
              dataGrid={slotProps?.grid?.dataGrid}
            />
          </Box>
        );
      }

      const disabled = disabledProp || mode === 'view' || !!spec.serverManaged || !!spec.locked;
      const control = renderControl({
        spec,
        label,
        value: getPath(value, spec.path),
        disabled,
        onChange: next => onChange(setPath(value, spec.path, next) as E),
        options,
        slotProps,
        error: errors?.[key],
      });
      return (
        <Box key={key} sx={{ mb: 2 }}>
          {control}
        </Box>
      );
    };

    if (sections.length < 2) {
      return <Box sx={{ width: '100%', minWidth: 0 }}>{sections[0]?.fields.map(field)}</Box>;
    }

    if (variant === 'stacked') {
      return (
        <Stack spacing={3} sx={{ minWidth: 0 }}>
          {sections.map(s => (
            <Box key={s.label} sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {s.label}
              </Typography>
              {s.fields.map(field)}
            </Box>
          ))}
        </Stack>
      );
    }

    return (
      <Box sx={{ minWidth: 0 }}>
        <Tabs
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          {...slotProps?.tabs}
          value={current}
          onChange={(_e, v: number) => setActive(v)}
          sx={{ mb: 2, ...slotProps?.tabs?.sx }}
        >
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
