import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Vehicle, EntityDetailsFormProps } from "../index";
import { VehicleForm, vehicleLayout, vehicleSample } from "./initDataSets";

const meta: Meta<typeof VehicleForm> = {
  title: "Forms/VehicleForm",
  component: VehicleForm,
  args: { mode: "edit", layout: vehicleLayout },
};
export default meta;
type Story = StoryObj<typeof VehicleForm>;

// Controlled wrapper so the story round-trips edits.
const Controlled = (args: EntityDetailsFormProps<Vehicle>) => {
  const [value, setValue] = useState<Vehicle>(vehicleSample);
  return <VehicleForm {...args} value={value} onChange={setValue} />;
};

export const Default: Story = { render: Controlled };
export const ViewOnly: Story = { render: Controlled, args: { mode: "view" } };
// No layout → every field renders flat (incl. the `datetime` meta timestamps),
// and `transportType` has no `options` closure, so it degrades to a free-text id.
export const ZeroConfig: Story = { render: Controlled, args: { layout: undefined } };
