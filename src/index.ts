/**
 * Public API of `@entur/mui-comps-nmr`.
 *
 * The generic form factory + data-aware form implementations, plus the
 * generated per-entity types and field registries. Consumers never import
 * from `generated/` directly.
 */
export { createAbstractEntityDetailsForm } from './EntityDetailsForm/abstractForm';
export { VehicleForm, VehicleTypeForm } from './EntityDetailsForm/formImpls';
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
