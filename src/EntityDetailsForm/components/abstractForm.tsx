import { useId, useState, type FC, type ReactNode } from 'react';
import { Box, Stack, Tab, Tabs, Typography } from '@mui/material';
import type { EntityDetailsFormProps, FieldSpec } from '../types';
import { getPath, setPath } from '../utils/paths';
import { resolveSections, type ResolvedField } from '../utils/sections';
import { renderControl } from './controls';
import { FieldRow, ROW_GRID_SX, FORM_CONTAINER_SX } from './FieldRow';
import { ObjectGrid } from '../../ObjectGrid';

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
    labelPlacement = 'float',
  }) => {
    const [active, setActive] = useState(0);
    // Ids are minted here, not in FieldRow: this is what calls `renderControl`,
    // so it is the only place that can put the matching id on the input. One
    // useId per form instance keeps two forms on one page from colliding.
    const uid = useId();
    const twoCol = labelPlacement === 'start';
    // Empty sections are dropped by `resolveSections` itself, so the skeleton
    // and the form always agree on how many there are.
    const sections = resolveSections(fields, layout);
    const current = Math.min(active, Math.max(0, sections.length - 1));

    const field = (
      { key, label, cols, options }: ResolvedField,
      _i: number,
      arr: ResolvedField[]
    ): ReactNode => {
      const spec = fields[key];
      const id = `${uid}${key}`;
      const disabled = disabledProp || mode === 'view' || !!spec.serverManaged || !!spec.locked;
      const error = errors?.[key];

      const body =
        spec.kind === 'grid' ? (
          <ObjectGrid
            rows={getPath(value, spec.path)}
            label={label}
            // The row draws the caption in two-column mode. ObjectGrid keeps
            // its `aria-label` either way, so the grid stays named.
            showLabel={!twoCol && arr.length > 1}
            cols={cols}
            dataGrid={slotProps?.grid?.dataGrid}
          />
        ) : (
          renderControl({
            spec,
            label,
            value: getPath(value, spec.path),
            disabled,
            onChange: next => onChange(setPath(value, spec.path, next) as E),
            options,
            slotProps,
            error,
            controlId: id,
            labelless: twoCol,
          })
        );

      return (
        <FieldRow
          key={key}
          id={id}
          label={label}
          placement={labelPlacement}
          disabled={disabled}
          error={!!error}
          // A grid renders a table, not a single control — ObjectGrid takes no
          // `id` to point a `<label htmlFor>` at, so a real label there would
          // dangle. FieldRow keeps the label visible in that case, just not as
          // a `<label>` element (see FieldRow's own doc on `labelable`).
          labelable={spec.kind !== 'grid'}
        >
          {body}
        </FieldRow>
      );
    };

    // The grid lives on the section container, never on the form root — a
    // `@container` rule resolves against an ancestor, so the element carrying
    // `container-type` has to be a different one.
    //
    // A plain function, deliberately NOT a component: a component declared in a
    // render body is a new type on every render, so React would unmount and
    // remount the whole section each keystroke and the focused input would lose
    // focus. Calling it just returns elements inline.
    const wrap = (rows: ReactNode): ReactNode =>
      twoCol ? <Box sx={ROW_GRID_SX}>{rows}</Box> : <>{rows}</>;

    if (sections.length < 2) {
      return (
        <Box sx={{ width: '100%', minWidth: 0, ...(twoCol ? FORM_CONTAINER_SX : {}) }}>
          {wrap(sections[0]?.fields.map(field))}
        </Box>
      );
    }

    if (variant === 'stacked') {
      return (
        <Stack spacing={3} sx={{ minWidth: 0, ...(twoCol ? FORM_CONTAINER_SX : {}) }}>
          {sections.map(s => (
            <Box key={s.label} sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {s.label}
              </Typography>
              {wrap(s.fields.map(field))}
            </Box>
          ))}
        </Stack>
      );
    }

    return (
      <Box sx={{ minWidth: 0, ...(twoCol ? FORM_CONTAINER_SX : {}) }}>
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
        {wrap(sections[current]?.fields.map(field))}
      </Box>
    );
  };
  Form.displayName = 'EntityDetailsForm';
  return Form;
}
