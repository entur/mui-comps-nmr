import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  createEntityDetailsForm,
  vehicleFields,
  type Vehicle,
  type VehicleLayout,
  type EntityDetailsFormProps,
  type RefOption,
} from "../index";

// The client names its own instance — the library exports only the factory.
const VehicleForm = createEntityDetailsForm<Vehicle>(vehicleFields);

// Candidate VehicleTypes for the `transportType` reference field. In a real app
// this dataset comes from a query; here it is a static list. The layout entry's
// `options` closure captures it — selecting writes `value` (a netexId) into the
// `transportType.netexId` leaf; `label` is display-only.
const vehicleTypeRefs: RefOption[] = [
  { value: "VEH:VehicleType:1", label: "Class 70 EMU" },
  { value: "VEH:VehicleType:2", label: "Class 80 DMU" },
  { value: "VEH:VehicleType:3", label: "Articulated Tram" },
];

// Single flat section (its label is unused when alone). `transportType` is a
// distilled `reference` field — read side is the full VehicleType relation, write
// side a `{ netexId }` ref; with `options` it renders as an Autocomplete (without,
// it degrades to a free-text id field — see the ZeroConfig story). `buildDate` /
// `registrationDate` are `date` controls; the meta timestamps are `datetime`.
const layout: VehicleLayout = {
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

const sample: Vehicle = {
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

const meta: Meta<typeof VehicleForm> = {
  title: "Forms/VehicleForm",
  component: VehicleForm,
  args: { mode: "edit", layout },
};
export default meta;
type Story = StoryObj<typeof VehicleForm>;

// Controlled wrapper so the story round-trips edits.
const Controlled = (args: EntityDetailsFormProps<Vehicle>) => {
  const [value, setValue] = useState<Vehicle>(sample);
  return <VehicleForm {...args} value={value} onChange={setValue} />;
};

export const Default: Story = { render: Controlled };
export const ViewOnly: Story = { render: Controlled, args: { mode: "view" } };
// No layout → every field renders flat (incl. the `datetime` meta timestamps),
// and `transportType` has no `options` closure, so it degrades to a free-text id.
export const ZeroConfig: Story = { render: Controlled, args: { layout: undefined } };
