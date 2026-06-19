import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { VehicleType, EntityDetailsFormProps } from "../index";
import { VehicleTypeForm, vehicleTypeLayout, vehicleTypeSample } from "./initDataSets";

const meta: Meta<typeof VehicleTypeForm> = {
  title: "Forms/VehicleTypeForm",
  component: VehicleTypeForm,
  args: { mode: "edit", layout: vehicleTypeLayout },
};
export default meta;
type Story = StoryObj<typeof VehicleTypeForm>;

// Controlled wrapper so the story round-trips edits.
const Controlled = (args: EntityDetailsFormProps<VehicleType>) => {
  const [value, setValue] = useState<VehicleType>(vehicleTypeSample);
  return <VehicleTypeForm {...args} value={value} onChange={setValue} />;
};

export const Tabs: Story = { render: Controlled };
export const Stacked: Story = { render: Controlled, args: { variant: "stacked" } };
export const TabsRO: Story = { render: Controlled, args: { mode: "view" } };
export const IncludeAllViaZeroConfig: Story = {
  render: Controlled,
  args: { layout: undefined },
};
