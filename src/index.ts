/**
 * Public API of `@entur/mui-comps-nmr`.
 *
 * The generic form factory + data-aware form implementations, plus the
 * generated per-entity types and field registries. Consumers never import
 * from `generated/` directly.
 */
export { createAbstractEntityDetailsForm } from './EntityDetailsForm/components/abstractForm';
export { SobekProvider, useSobekCtx } from './context/SobekContext';
export type { SobekCtx } from './context/SobekContext';
// Edit-session chrome. The data-aware wrappers render `EditFooter` themselves;
// both are exported for hosts driving the presentational form directly, and for
// the save feedback the wrappers only report through `onSaved` / `onError`.
export { EditFooter } from './EntityDetailsForm/components/EditFooter';
export { SaveSnackbar } from './EntityDetailsForm/components/SaveSnackbar';
export type {
  EditFooterProps,
  EditFooterLabels,
  EditFooterSlotProps,
  EditFooterHostProps,
} from './EntityDetailsForm/components/EditFooter';
export type { SaveSnackbarProps, SaveToast } from './EntityDetailsForm/components/SaveSnackbar';
// Generated wrappers + their props types: VehicleTypeForm/VehicleTypeFormProps,
// VehicleForm/VehicleFormProps. Re-exported wholesale rather than named, so a
// new manifest entry reaches the public API the moment it is generated.
export * from './EntityDetailsForm/formImpls';
export type {
  EntityDetailsFormProps,
  EntityDetailsForm,
  FieldSpec,
  FieldKind,
  FieldEntry,
  LayoutItem,
  Layout,
  LayoutVariant,
  ControlSlotProps,
  RefOption,
} from './EntityDetailsForm/types';

// Generated entity types + field registries: VehicleType, VehicleTypeLayout,
// vehicleTypeFields, Vehicle, VehicleLayout, vehicleFields.
export * from './entities';
