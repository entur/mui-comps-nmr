import { useState } from 'react';
import { Box } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { VehicleTypeForm, type VehicleTypeFormProps } from './VehicleTypeForm';
import type { VehicleType } from '../../generated/sobekTypes';
import {
  FuelType,
  HybridCategory,
  PropulsionType,
  TransportMode,
} from '../../generated/sobekTypes';
import type { TFn } from './labels';

/** A realistic sample: NSB BM73 tilting electric multiple unit. */
const sample: VehicleType = {
  netexId: 'NSB:VehicleType:BM73',
  name: { value: 'Type 73 — Signatur', lang: 'no' },
  shortName: { value: 'BM73' },
  description: { value: 'Tilting electric multiple unit' },
  transportMode: TransportMode.Rail,
  length: 26.2,
  width: 2.65,
  height: 3.8,
  weight: 220000,
  lowFloor: false,
  propulsionTypes: [PropulsionType.Electric],
  fuelTypes: [FuelType.Electricity],
  selfPropelled: true,
  euroClass: '—',
  maximumVelocity: 210,
  maximumRange: 600,
  formDragCoefficient: 0.28,
  rollResistanceCoefficient: 0.002,
  maximumEngineEffectKW: 2600,
  hybridCategory: HybridCategory.Nonchargeable,
  passengerCapacity: {
    totalCapacity: 207,
    seatingCapacity: 207,
    standingCapacity: 0,
    bicycleRackCapacity: 8,
  },
};

/** Stateful wrapper so edits round-trip live through `onChange` in the canvas. */
const Live = (args: VehicleTypeFormProps) => {
  const [v, setV] = useState<VehicleType>(args.value);
  return (
    <Box sx={{ maxWidth: 560 }}>
      <VehicleTypeForm {...args} value={v} onChange={setV} />
    </Box>
  );
};

const meta: Meta<typeof VehicleTypeForm> = {
  title: 'Vehicle Types/VehicleTypeForm',
  component: VehicleTypeForm,
  parameters: { layout: 'padded' },
  render: args => <Live {...args} />,
};
export default meta;

type Story = StoryObj<typeof VehicleTypeForm>;

export const Edit: Story = { args: { value: sample, mode: 'edit' } };

export const View: Story = { args: { value: sample, mode: 'view' } };

/** Norwegian labels via an injected `t` — proves the i18n boundary works with
 *  zero i18n runtime dependency in the library. */
const NB: Record<string, string> = {
  'vehicleType.tab.edit': 'Rediger',
  'vehicleType.tab.propulsion': 'Framdrift',
  'vehicleType.tab.capacity': 'Kapasitet',
  'vehicleType.tab.environment': 'Miljø',
  'vehicleType.field.name': 'Navn',
  'vehicleType.field.shortName': 'Kortnavn',
  'vehicleType.field.description': 'Beskrivelse',
  'vehicleType.field.transportMode': 'Transportmiddel',
  'common.none': 'Ingen',
};
const nb: TFn = (key, fallback) => NB[key] ?? fallback;

export const Localised: Story = { args: { value: sample, mode: 'edit', t: nb } };
