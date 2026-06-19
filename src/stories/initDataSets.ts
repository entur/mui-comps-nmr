/**
 * Shared fixtures for the form stories — form instances, layouts, sample
 * entities, and reference option-lists for both `VehicleType` and `Vehicle`.
 * Lifted out of the individual `*.stories` files so the plain forms and the
 * `compositions/*` stories (which mount the same forms inside a Drawer) draw
 * from one source of truth.
 */
import {
  createEntityDetailsForm,
  vehicleFields,
  vehicleTypeFields,
  type Vehicle,
  type VehicleType,
  type VehicleLayout,
  type VehicleTypeLayout,
  type RefOption,
} from "../index";
// Generated `Vehicle` (aliased) is the nested grid-row shape on VehicleType;
// distinct from the index `Vehicle` entity used as the Vehicle-form value.
import { TransportMode, type Vehicle as GenVehicle } from "../generated/sobekTypes";

// The client names its own instances — the library exports only the factory.
export const VehicleForm = createEntityDetailsForm<Vehicle>(vehicleFields);
export const VehicleTypeForm = createEntityDetailsForm<VehicleType>(vehicleTypeFields);

// ── reference option-lists ────────────────────────────────────────────────
// In a real app these come from a query; here they are static. A layout entry's
// `options` closure captures one — selecting writes `value` (a netexId) into the
// reference field's id leaf, `label` is display-only.

/** Candidate VehicleTypes for `Vehicle.transportType`. */
export const vehicleTypeRefs: RefOption[] = [
  { value: "VEH:VehicleType:1", label: "Class 70 EMU" },
  { value: "VEH:VehicleType:2", label: "Class 80 DMU" },
  { value: "VEH:VehicleType:3", label: "Articulated Tram" },
];

/** Candidate DeckPlans for `VehicleType.deckPlan`. */
export const deckPlanRefs: RefOption[] = [
  { value: "VEH:DeckPlan:1", label: "Single-deck 2+2" },
  { value: "VEH:DeckPlan:2", label: "Double-deck" },
  { value: "VEH:DeckPlan:3", label: "Low-floor articulated" },
];

// ── VehicleType ─────────────────────────────────────────────────────────────

// Object-key order = section order; array order = field order within the
// section. `deckPlan` (a distilled `reference`) sits under `transportMode`;
// `vehicles` is a distilled `grid` (serverManaged) rendered as a read-only table.
export const vehicleTypeLayout: VehicleTypeLayout = {
  Edit: [
    "name",
    "transportMode",
    { field: "deckPlan", options: () => deckPlanRefs },
    "length",
    "width",
    "height",
    "weight",
    "lowFloor",
  ],
  Propulsion: [
    "propulsionTypes",
    "fuelTypes",
    "selfPropelled",
    "maximumVelocity",
    "maximumRange",
  ],
  Capacity: [
    "totalCapacity",
    "seatingCapacity",
    "standingCapacity",
    "wheelchairPlaceCapacity",
    "pramPlaceCapacity",
    "bicycleRackCapacity",
    "fareClass",
  ],
  Environment: [
    "formDragCoefficient",
    "rollResistanceCoefficient",
    "maximumEngineEffectKW",
    "hybridCategory",
  ],
  Vehicles: [
    {
      field: "vehicles",
      entries: [
        { field: "name", label: "Name" },
        { field: "operationalNumber", label: "Op. No." },
      ],
    },
  ],
};

const sampleVehicles: GenVehicle[] = [
  { netexId: "VEH:Vehicle:701", name: { lang: "en", value: "Unit 701" }, operationalNumber: "701" },
  { netexId: "VEH:Vehicle:702", name: { lang: "en", value: "Unit 702" }, operationalNumber: "702" },
];

export const vehicleTypeSample: VehicleType = {
  netexId: "VEH:VehicleType:1",
  name: { lang: "en", value: "Class 70 EMU" },
  transportMode: TransportMode.Rail,
  deckPlan: { netexId: "VEH:DeckPlan:1" },
  length: 26.4,
  lowFloor: true,
  vehicles: sampleVehicles,
};

// ── Vehicle ───────────────────────────────────────────────────────────────

// Single flat section (its label is unused when alone). `transportType` is a
// distilled `reference`; `buildDate` / `registrationDate` are `date` controls;
// the meta timestamps are `datetime`.
export const vehicleLayout: VehicleLayout = {
  Edit: [
    "name",
    "registrationNumber",
    { field: "transportType", label: "VehicleType", options: () => vehicleTypeRefs },
    "operationalNumber",
    "chassisNumber",
    "buildDate",
    "registrationDate",
    "description",
  ],
};

export const vehicleSample: Vehicle = {
  netexId: "VEH:Vehicle:701",
  name: { lang: "en", value: "Unit 701" },
  registrationNumber: "AB 12345",
  transportType: { netexId: "VEH:VehicleType:1" },
  operationalNumber: "701",
  chassisNumber: "CHS-0000-701",
  buildDate: "2019-06-01",
  registrationDate: "2020-01-15",
  description: { lang: "en", value: "EMU passenger unit" },
  created: "2020-01-15T09:30:00Z",
  changed: "2024-03-02T14:12:00Z",
  changedBy: "importer",
  version: "3",
};
