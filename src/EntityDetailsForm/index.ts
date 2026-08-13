/**
 * Internal barrel for EntityDetailsForm (not the public API).
 */
export { createAbstractEntityDetailsForm } from './abstractForm';
export { useEntityForm } from './hooks/useEntityForm';
export { EditFooter } from './EditFooter';
export { SaveSnackbar } from './SaveSnackbar';
export type { EditFooterProps, EditFooterLabels, EditFooterSlotProps, EditFooterHostProps } from './EditFooter';
export type { SaveSnackbarProps, SaveToast } from './SaveSnackbar';
export { toInputEntity } from './toInput';
export { normalizeEntityErrors } from './normalizeErrors';
export type {
  EntityDetailsFormProps,
  FieldSpec,
  FieldKind,
  FieldEntry,
  LayoutItem,
  Layout,
  LayoutVariant,
  ControlSlotProps,
  RefOption,
} from './types';
