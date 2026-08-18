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
const COL_GAP = 2, ROW_GAP = 2;
// MUI's own FormLabel line-height, restated so the skeleton can adopt it.
const LABEL_LH = '1.4375em';

/** Top offset that lines the label's first line up with the control beside it.
 *  Exported for {@link FormSkeleton}'s placeholder, which has to start at the
 *  same y or the label drops 8px on arrival. */
export const LABEL_PT = 1;

/** `FormLabel`'s own type ramp, named rather than left implicit. The skeleton's
 *  placeholder is a bare element and would otherwise inherit ambient typography
 *  — two ramps resolve two different `max-content` widths for the same text,
 *  which shifts the whole label column sideways when the form arrives. */
export const LABEL_TYPE_SX = { typography: 'body1', lineHeight: LABEL_LH } as const;

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
  /** DOM id put on the label element itself, so a control that cannot be reached
   *  by `htmlFor` can point back at it with `aria-labelledby`. That is the only
   *  route left for a `kind: 'enum'`, whose MUI `Select` renders a
   *  `div[role=combobox]` — a *non-labelable* element, so `<label for>` at it is
   *  discarded by the accessibility mapping and the control ends up unnamed.
   *  Optional: rows whose control is labelable need nothing here. */
  labelId?: string;
  /** Resolved label (layout override, or the humanized key). */
  label: string;
  placement: LabelPlacement;
  /** Greys the label alongside its control (view mode, serverManaged, locked). */
  disabled?: boolean;
  /** Tints the label alongside a control showing a server validation error. */
  error?: boolean;
  /** Whether `id` names a single labelable form control. Default `true`. Two
   *  kinds set `false`:
   *
   *  - `grid` renders a data table, not a control — a `<label htmlFor>` pointing
   *    at it (or at nothing, since `ObjectGrid` takes no `id`) would be invalid
   *    markup. Its accessible name comes from `ObjectGrid`'s own unconditional
   *    `aria-label`, not from this label.
   *  - `enum` renders `div[role=combobox]`, which is not a labelable element;
   *    it is named via {@link FieldRowProps.labelId} + `aria-labelledby` instead.
   *
   *  Either way the label stays visible, in the left column, greyed/tinted the
   *  same way — it is just not emitted as a `<label>` element. */
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
  labelId,
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
        id={labelId}
        htmlFor={labelable ? id : undefined}
        disabled={disabled}
        error={error}
        sx={{ pt: LABEL_PT, ...LABEL_TYPE_SX }}
      >
        {label}
      </FormLabel>
      {children}
    </>
  );
}
