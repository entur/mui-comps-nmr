/**
 * Internal barrel for EntityDetailsForm (not the public API).
 */
export { createAbstractEntityDetailsForm } from './components/abstractForm';
export { useEntityForm } from './hooks/useEntityForm';
export { EditFooter } from './components/EditFooter';
export { SaveSnackbar } from './components/SaveSnackbar';
export type { EditFooterProps, EditFooterLabels, EditFooterSlotProps, EditFooterHostProps } from './components/EditFooter';
export type { SaveSnackbarProps, SaveToast } from './components/SaveSnackbar';
export { toInputEntity } from './utils/toInput';
export { normalizeEntityErrors } from './utils/normalizeErrors';
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
