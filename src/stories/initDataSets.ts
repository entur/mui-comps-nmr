/**
 * Data fixtures for the form stories — the sample entities the forms render and
 * the read-side seed the data-aware story serves. Each story mints its own form
 * instance from the factory; layout config (section/field arrangement) and the
 * reference option-lists live in `initLayouts.ts`. Keeping these apart separates
 * *what's in* an entity from *how* its fields are grouped, and from *what* renders it.
 */
import type { Vehicle, VehicleType } from "../index";
// Generated `Vehicle` (aliased) is the nested grid-row shape on VehicleType;
// distinct from the index `Vehicle` entity used as the Vehicle-form value.
import { TransportMode, type Vehicle as GenVehicle } from "../generated/sobekTypes";

// ── VehicleType ─────────────────────────────────────────────────────────────

const sampleVehicles: GenVehicle[] = [
  { netexId: "VEH:Vehicle:701", name: { lang: "en", value: "Unit 701" }, operationalNumber: "701", dataOwnerRef: "" },
  { netexId: "VEH:Vehicle:702", name: { lang: "en", value: "Unit 702" }, operationalNumber: "702", dataOwnerRef: "" },
];

export const vehicleTypeSample: VehicleType = {
  netexId: "VEH:VehicleType:1",
  name: { lang: "en", value: "Class 70 EMU" },
  transportMode: TransportMode.Rail,
  deckPlan: { netexId: "VEH:DeckPlan:1", dataOwnerRef: "" },
  length: 26.4,
  lowFloor: true,
  dataOwnerRef: "",
  vehicles: sampleVehicles,
};

/**
 * A few VehicleTypes keyed by `netexId` — the read-side seed the data-aware host
 * story serves so its VehicleType list has more than one record. Each derives
 * from {@link vehicleTypeSample}, overriding the identifying fields.
 */
export const vehicleTypeSeed: Record<string, VehicleType> = {
  [vehicleTypeSample.netexId]: vehicleTypeSample,
  "VEH:VehicleType:2": {
    ...vehicleTypeSample,
    netexId: "VEH:VehicleType:2",
    name: { lang: "en", value: "Class 80 DMU" },
    deckPlan: { netexId: "VEH:DeckPlan:2", dataOwnerRef: "" },
    length: 23.0,
    lowFloor: false,
    vehicles: [],
  },
  "VEH:VehicleType:3": {
    ...vehicleTypeSample,
    netexId: "VEH:VehicleType:3",
    name: { lang: "en", value: "Articulated Tram" },
    deckPlan: { netexId: "VEH:DeckPlan:3", dataOwnerRef: "" },
    length: 32.0,
    lowFloor: true,
    vehicles: [],
  },
};

// ── Vehicle ───────────────────────────────────────────────────────────────

export const vehicleSample: Vehicle = {
  netexId: "VEH:Vehicle:701",
  name: { lang: "en", value: "Unit 701" },
  registrationNumber: "AB 12345",
  transportType: { netexId: "VEH:VehicleType:1", dataOwnerRef: "" },
  operationalNumber: "701",
  chassisNumber: "CHS-0000-701",
  buildDate: "2019-06-01",
  registrationDate: "2020-01-15",
  description: { lang: "en", value: "EMU passenger unit" },
  dataOwnerRef: "",
  created: "2020-01-15T09:30:00Z",
  changed: "2024-03-02T14:12:00Z",
  changedBy: "importer",
  version: "3",
};

/**
 * A few Vehicles keyed by `netexId` — the read-side seed the data-aware host
 * story serves through its mock endpoint, so its list has more than one record
 * to switch between. Each derives from {@link vehicleSample}, overriding just
 * the identifying fields.
 */
export const vehicleSeed: Record<string, Vehicle> = {
  [vehicleSample.netexId]: vehicleSample,
  "VEH:Vehicle:702": {
    ...vehicleSample,
    netexId: "VEH:Vehicle:702",
    name: { lang: "en", value: "Unit 702" },
    registrationNumber: "CD 67890",
    transportType: { netexId: "VEH:VehicleType:2", dataOwnerRef: "" },
    operationalNumber: "702",
    chassisNumber: "CHS-0000-702",
    description: { lang: "en", value: "DMU passenger unit" },
  },
  "VEH:Vehicle:703": {
    ...vehicleSample,
    netexId: "VEH:Vehicle:703",
    name: { lang: "en", value: "Tram 12" },
    registrationNumber: "EF 11223",
    transportType: { netexId: "VEH:VehicleType:3", dataOwnerRef: "" },
    operationalNumber: "12",
    chassisNumber: "CHS-0000-012",
    buildDate: "2022-03-10",
    registrationDate: "2022-09-01",
    description: { lang: "en", value: "Articulated low-floor tram" },
  },
};
