/**
 * One field's row wrapper — the single place that knows how a label is placed.
 *
 * `'float'` reproduces the original markup exactly: a spacing Box around the
 * control, whose MUI label floats inside it. `'start'` emits the label and the
 * control as two *siblings*, so each lands as its own item of the grid that the
 * section container declares via {@link ROW_GRID_SX}.
 *
 * Exporting that grid from here is the point. `FormSkeleton` imports the same
 * constant, so the placeholder's columns cannot drift from the form's — the
 * horizontal counterpart of what `resolveSections` already does for row counts.
 */
import type { ReactNode } from 'react';
import { Box, FormLabel } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import type { LabelPlacement } from '../types';

// Row geometry. COLLAPSE_W is the one genuine threshold in the layout: below it
// the control column is too narrow to be usable, so the label falls above.
const COLLAPSE_W = 480;
const COL_GAP = 2, ROW_GAP = 2, LABEL_PT = 1;

/** Marks the form root as a query container. Kept separate from
 *  {@link ROW_GRID_SX} deliberately: a `@container` rule resolves against the
 *  nearest *ancestor* container, so an element carrying both would query an
 *  outer one and silently ignore its own width.
 *
 *  Typed as a plain object rather than `SxProps<Theme>` on purpose — callers
 *  spread it into a larger `sx`, and `SxProps` is a union that includes arrays
 *  and functions, which cannot be spread. */
export const FORM_CONTAINER_SX = { containerType: 'inline-size' } as const;

/** The two-column grid a section container declares in `'start'` mode.
 *
 *  The label column sizes to the widest label in *that* section (`max-content`),
 *  so no width literal exists to drift; `minmax(0, …)` stops a long label
 *  overflowing. The collapse is keyed to the form's own inline size rather than
 *  the viewport, so a narrow drawer on a wide monitor collapses too. */
export const ROW_GRID_SX: SxProps<Theme> = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, max-content) 1fr',
  columnGap: COL_GAP,
  rowGap: ROW_GAP,
  alignItems: 'start',
  [`@container (max-width: ${COLLAPSE_W}px)`]: { gridTemplateColumns: '1fr' },
};

export interface FieldRowProps {
  /** DOM id of the control this row labels — the `htmlFor` target. Ignored when
   *  {@link FieldRowProps.labelable} is `false`. */
  id: string;
  /** Resolved label (layout override, or the humanized key). */
  label: string;
  placement: LabelPlacement;
  /** Greys the label alongside its control (view mode, serverManaged, locked). */
  disabled?: boolean;
  /** Tints the label alongside a control showing a server validation error. */
  error?: boolean;
  /** Whether `id` names a single labelable form control. Default `true`. A
   *  `grid` field renders a data table, not a control — a `<label htmlFor>`
   *  pointing at it (or at nothing, since `ObjectGrid` takes no `id`) would be
   *  invalid markup, so those rows pass `false` here to keep the visible label
   *  (still placed in the left column, still greyed/tinted the same way) while
   *  rendering it as a non-`<label>` element. The grid's accessible name comes
   *  from `ObjectGrid`'s own unconditional `aria-label`, not from this label. */
  labelable?: boolean;
  children: ReactNode;
}

/**
 * Wrap one field's control, placing its label per {@link FieldRowProps.placement}.
 *
 * @param props see {@link FieldRowProps}
 * @returns in `'float'` a spacing Box; in `'start'` a label + the control, as
 *          sibling grid items
 */
export function FieldRow({
  id,
  label,
  placement,
  disabled,
  error,
  labelable = true,
  children,
}: FieldRowProps) {
  if (placement === 'float') return <Box sx={{ mb: ROW_GAP }}>{children}</Box>;
  return (
    <>
      <FormLabel
        component={labelable ? 'label' : 'span'}
        htmlFor={labelable ? id : undefined}
        disabled={disabled}
        error={error}
        sx={{ pt: LABEL_PT }}
      >
        {label}
      </FormLabel>
      {children}
    </>
  );
}
