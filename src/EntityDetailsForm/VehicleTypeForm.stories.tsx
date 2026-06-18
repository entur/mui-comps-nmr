import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  createEntityDetailsForm,
  vehicleTypeFields,
  type VehicleType,
  type VehicleTypeLayout,
  type EntityDetailsFormProps,
} from '../index';
import { TransportMode } from '../generated/sobekTypes'; // internal-only; sample data

// The client names its own instance — the library exports only the factory.
const VehicleTypeForm = createEntityDetailsForm<VehicleType>(vehicleTypeFields);

// Object-key order = section order; array order = field order within the section.
// Sections render as tabs or stacked panels per `variant` (default 'tabs').
// Capacity leaves are individually placeable (flattened by distillTypes).
const layout: VehicleTypeLayout = {
  Edit: ['name', 'transportMode', 'length', 'width', 'height', 'weight', 'lowFloor'],
  Propulsion: ['propulsionTypes', 'fuelTypes', 'selfPropelled', 'maximumVelocity', 'maximumRange'],
  Capacity: [
    'totalCapacity',
    'seatingCapacity',
    'standingCapacity',
    'wheelchairPlaceCapacity',
    'pramPlaceCapacity',
    'bicycleRackCapacity',
    'fareClass',
  ],
  Environment: [
    'formDragCoefficient',
    'rollResistanceCoefficient',
    'maximumEngineEffectKW',
    'hybridCategory',
  ],
};

const sample: VehicleType = {
  netexId: 'VEH:VehicleType:1',
  name: { lang: 'en', value: 'Class 70 EMU' },
  transportMode: TransportMode.Rail,
  length: 26.4,
  lowFloor: true,
};

const meta: Meta<typeof VehicleTypeForm> = {
  title: 'Forms/VehicleTypeForm',
  component: VehicleTypeForm,
  args: { mode: 'edit', layout },
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
  args: { variant: 'stacked' },
};
export const TabsRO: Story = { render: Controlled, args: { mode: 'view' } };
export const IncludeAllViaZeroConfig: Story = { render: Controlled, args: { layout: undefined } };
