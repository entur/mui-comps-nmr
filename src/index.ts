/**
 * Public API of `@entur/nmr-comps`.
 *
 * Components plus the data types/enums consumers need to shape the data they
 * pass in. The data types are re-exported from the codegen'd sobek schema so
 * callers never import from `generated/` directly.
 */
export { VehicleTypeForm } from './components/VehicleTypeForm/VehicleTypeForm';
export type { VehicleTypeFormProps } from './components/VehicleTypeForm/VehicleTypeForm';
export { defaultT, type TFn } from './components/VehicleTypeForm/labels';

export type {
  VehicleType,
  PassengerCapacity,
  MultilingualString,
} from './generated/sobekTypes';
export {
  PropulsionType,
  FuelType,
  HybridCategory,
  TransportMode,
} from './generated/sobekTypes';
