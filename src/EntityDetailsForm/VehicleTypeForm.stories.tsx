import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  createEntityDetailsForm,
  vehicleTypeFields,
  type VehicleType,
  type VehicleTypeLayout,
  type EntityDetailsFormProps,
  type RefOption,
} from "../index";
import { TransportMode, type Vehicle } from "../generated/sobekTypes"; // internal-only; sample data

// The client names its own instance — the library exports only the factory.
const VehicleTypeForm = createEntityDetailsForm<VehicleType>(vehicleTypeFields);

// Candidate DeckPlans for the `deckPlan` reference field — in a real app this
// comes from a query. The layout entry's `options` closure captures it; selecting
// writes `value` (a netexId) into the `deckPlan.netexId` leaf, `label` displays.
const deckPlanRefs: RefOption[] = [
  { value: "VEH:DeckPlan:1", label: "Single-deck 2+2" },
  { value: "VEH:DeckPlan:2", label: "Double-deck" },
  { value: "VEH:DeckPlan:3", label: "Low-floor articulated" },
];

// Object-key order = section order; array order = field order within the section.
// Sections render as tabs or stacked panels per `variant` (default 'tabs').
// Capacity leaves are individually placeable (flattened by distillTypes).
// `vehicles` is a distilled `grid` field (serverManaged, auto-derived from the
// Input boundary) — placed in its own section, it renders as a read-only table.
// Its `entries` fix the column order and labels; omit `entries` to auto-derive
// every column from the row data.
const layout: VehicleTypeLayout = {
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
        /*{ field: 'netexId', label: 'NeTEx ID' },*/
        { field: "name", label: "Name" },
        { field: "operationalNumber", label: "Op. No." },
      ],
    },
  ],
};

const sampleVehicles: Vehicle[] = [
  {
    netexId: "VEH:Vehicle:701",
    name: { lang: "en", value: "Unit 701" },
    operationalNumber: "701",
  },
  {
    netexId: "VEH:Vehicle:702",
    name: { lang: "en", value: "Unit 702" },
    operationalNumber: "702",
  },
];

const sample: VehicleType = {
  netexId: "VEH:VehicleType:1",
  name: { lang: "en", value: "Class 70 EMU" },
  transportMode: TransportMode.Rail,
  deckPlan: { netexId: "VEH:DeckPlan:1" },
  length: 26.4,
  lowFloor: true,
  vehicles: sampleVehicles,
};

const meta: Meta<typeof VehicleTypeForm> = {
  title: "Forms/VehicleTypeForm",
  component: VehicleTypeForm,
  args: { mode: "edit", layout },
};
export default meta;
type Story = StoryObj<typeof VehicleTypeForm>;

// Controlled wrapper so the story round-trips edits.
const Controlled = (args: EntityDetailsFormProps<VehicleType>) => {
  const [value, setValue] = useState<VehicleType>(sample);
  return <VehicleTypeForm {...args} value={value} onChange={setValue} />;
};

export const Tabs: Story = { render: Controlled };
export const Stacked: Story = {
  render: Controlled,
  args: { variant: "stacked" },
};
export const TabsRO: Story = { render: Controlled, args: { mode: "view" } };
export const IncludeAllViaZeroConfig: Story = {
  render: Controlled,
  args: { layout: undefined },
};
