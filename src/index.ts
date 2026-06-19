/**
 * Public API of `@entur/mui-comps-nmr`.
 *
 * The generic form factory + its types, plus the generated per-entity types and
 * field registries (from the distilled `src/entities` barrel). Consumers never
 * import from `generated/` directly.
 */
export { createEntityDetailsForm } from './EntityDetailsForm';
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
