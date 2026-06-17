import { useState, type ReactNode } from 'react';
import {
  Autocomplete,
  Box,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
} from '@mui/material';
import type {
  MultilingualString,
  PassengerCapacity,
  VehicleType,
} from '../../generated/sobekTypes';
import {
  FuelType,
  HybridCategory,
  PropulsionType,
  TransportMode,
} from '../../generated/sobekTypes';
import { defaultT, type TFn } from './labels';

/* ------------------------------------------------------------------ *\
   Constants
\* ------------------------------------------------------------------ */

/** Editor tabs, in display order. The vehicles tab is intentionally absent —
 *  vehicle linkage is a future, separately-published component. */
const TAB_KEYS = ['edit', 'propulsion', 'capacity', 'environment'] as const;
type TabKey = (typeof TAB_KEYS)[number];

/** Numeric passenger-capacity keys (everything but the `fareClass` enum). */
type NumericCapKey = Exclude<keyof PassengerCapacity, 'fareClass'>;

/** Runtime member lists, derived from the codegen'd enums (single source of
 *  truth = the sobek schema). Drive the select/autocomplete option sets. */
const PROPULSION = Object.values(PropulsionType);
const FUEL = Object.values(FuelType);
const HYBRID = Object.values(HybridCategory);
const MODES = Object.values(TransportMode);

const GRID_HALF = { xs: 12, sm: 6 } as const;

/* ------------------------------------------------------------------ *\
   Value helpers (pure)
\* ------------------------------------------------------------------ */

const numVal = (n?: number | null): number | '' => (n == null ? '' : n);
const numOr = (s: string): number | undefined => (s === '' ? undefined : Number(s));
const textOr = (s: string): string | undefined => (s === '' ? undefined : s);
const nameVal = (n?: MultilingualString | null): string => n?.value ?? '';

/** Merge edited text into a NeTEx `MultilingualString`, preserving its `lang`
 *  tag. Blank text clears the whole name (`undefined`). */
const mergeName = (
  cur: MultilingualString | null | undefined,
  text: string
): MultilingualString | undefined => (text === '' ? undefined : { ...cur, value: text });

/* ------------------------------------------------------------------ *\
   Component
\* ------------------------------------------------------------------ */

export interface VehicleTypeFormProps {
  /** Current vehicle type (shaped like the codegen'd `VehicleType`). */
  value: VehicleType;
  /** Fired with the merged next value on every field edit. */
  onChange: (next: VehicleType) => void;
  /** `'view'` disables every input; `'edit'` enables them. */
  mode: 'view' | 'edit';
  /** Optional translate fn `(key, fallback) => string`. Defaults to the English
   *  fallback. Pass `react-i18next`'s `t` (or similar) to localise. */
  t?: TFn;
}

/**
 * Reusable, presentational `VehicleType` editor — a tabbed form driven entirely
 * by `value` / `onChange` / `mode`. Holds no fetch/save logic, no i18n runtime,
 * and no router dependency, so it drops into any MUI app. Tabs: Edit (identity +
 * dimensions) · Propulsion/performance · Passenger capacity · Environment.
 *
 * @param value    Current `VehicleType`.
 * @param onChange Receives the merged next value on each edit.
 * @param mode     `'view'` (read-only) or `'edit'`.
 * @param t        Optional translate function; English fallbacks by default.
 */
export function VehicleTypeForm({ value, onChange, mode, t = defaultT }: VehicleTypeFormProps) {
  const [tab, setTab] = useState<TabKey>('edit');
  const ro = mode === 'view';

  const setField = (patch: Partial<VehicleType>) => onChange({ ...value, ...patch });

  const setName = (key: 'name' | 'shortName' | 'description', text: string) =>
    setField({ [key]: mergeName(value[key], text) } as Partial<VehicleType>);

  const setCapacity = (patch: Partial<PassengerCapacity>) => {
    const merged = { ...value.passengerCapacity, ...patch };
    // Collapse back to `undefined` when every count is cleared, so the object
    // doesn't linger as `{}` and read as dirty against an absent baseline.
    const hasAny = Object.values(merged).some(v => v != null);
    onChange({ ...value, passengerCapacity: hasAny ? (merged as PassengerCapacity) : undefined });
  };

  /* --- field renderers (read-only aware) --- */

  const lbl = (key: string, fallback: string) => t(`vehicleType.field.${key}`, fallback);

  const numField = (key: keyof VehicleType, fallback: string): ReactNode => (
    <TextField
      label={lbl(String(key), fallback)}
      type="number"
      value={numVal(value[key] as number | null | undefined)}
      onChange={e => setField({ [key]: numOr(e.target.value) } as Partial<VehicleType>)}
      disabled={ro}
      size="small"
      fullWidth
    />
  );

  const textField = (key: keyof VehicleType, fallback: string): ReactNode => (
    <TextField
      label={lbl(String(key), fallback)}
      value={(value[key] as string | null | undefined) ?? ''}
      onChange={e => setField({ [key]: textOr(e.target.value) } as Partial<VehicleType>)}
      disabled={ro}
      size="small"
      fullWidth
    />
  );

  const nameField = (key: 'name' | 'shortName' | 'description', fallback: string): ReactNode => (
    <TextField
      label={lbl(String(key), fallback)}
      value={nameVal(value[key])}
      onChange={e => setName(key, e.target.value)}
      disabled={ro}
      size="small"
      fullWidth
    />
  );

  const capField = (key: NumericCapKey, fallback: string): ReactNode => (
    <TextField
      label={lbl(`capacity.${String(key)}`, fallback)}
      type="number"
      value={numVal(value.passengerCapacity?.[key])}
      onChange={e => setCapacity({ [key]: numOr(e.target.value) } as Partial<PassengerCapacity>)}
      disabled={ro}
      size="small"
      fullWidth
    />
  );

  const switchField = (key: 'lowFloor' | 'selfPropelled', fallback: string): ReactNode => (
    <FormControlLabel
      control={
        <Switch
          checked={!!value[key]}
          onChange={e => setField({ [key]: e.target.checked } as Partial<VehicleType>)}
          disabled={ro}
        />
      }
      label={lbl(String(key), fallback)}
    />
  );

  const enumMulti = (
    key: 'propulsionTypes' | 'fuelTypes',
    fallback: string,
    options: string[]
  ): ReactNode => (
    <Autocomplete
      multiple
      size="small"
      disabled={ro}
      options={options}
      value={((value[key] ?? []).filter(Boolean) as string[]) ?? []}
      onChange={(_e, v) =>
        setField({ [key]: v.length ? v : undefined } as unknown as Partial<VehicleType>)
      }
      renderInput={params => <TextField {...params} label={lbl(String(key), fallback)} />}
    />
  );

  const enumSelect = (
    key: 'transportMode' | 'hybridCategory',
    fallback: string,
    options: string[]
  ): ReactNode => (
    <TextField
      select
      label={lbl(String(key), fallback)}
      value={(value[key] as string | null | undefined) ?? ''}
      onChange={e =>
        setField({ [key]: (e.target.value || undefined) } as unknown as Partial<VehicleType>)
      }
      disabled={ro}
      size="small"
      fullWidth
    >
      <MenuItem value="">
        <em>{t('common.none', 'None')}</em>
      </MenuItem>
      {options.map(o => (
        <MenuItem key={o} value={o}>
          {o}
        </MenuItem>
      ))}
    </TextField>
  );

  return (
    <Box>
      {/* Pill/segmented tabs: hide the sliding indicator (it misaligns once
          tabs wrap in a narrow container) and mark the active tab with a filled
          background. Tabs wrap rather than scroll. */}
      <Tabs
        value={tab}
        onChange={(_e, v: TabKey) => setTab(v)}
        sx={{
          mb: 2,
          minHeight: 0,
          '& .MuiTabs-indicator': { display: 'none' },
          '& .MuiTabs-flexContainer': { flexWrap: 'wrap', gap: 0.75 },
          '& .MuiTab-root': {
            minHeight: 30,
            px: 1.25,
            py: 0.25,
            borderRadius: 1,
            textTransform: 'none',
            '&.Mui-selected': { bgcolor: 'action.selected' },
          },
        }}
      >
        <Tab value="edit" label={t('vehicleType.tab.edit', 'Edit')} />
        <Tab value="propulsion" label={t('vehicleType.tab.propulsion', 'Propulsion')} />
        <Tab value="capacity" label={t('vehicleType.tab.capacity', 'Capacity')} />
        <Tab value="environment" label={t('vehicleType.tab.environment', 'Environment')} />
      </Tabs>

      {tab === 'edit' && (
        <Stack spacing={2}>
          {nameField('name', 'Name')}
          {nameField('shortName', 'Short name')}
          {nameField('description', 'Description')}
          {enumSelect('transportMode', 'Transport mode', MODES)}
          <Grid container spacing={2}>
            <Grid size={GRID_HALF}>{numField('length', 'Length (m)')}</Grid>
            <Grid size={GRID_HALF}>{numField('width', 'Width (m)')}</Grid>
            <Grid size={GRID_HALF}>{numField('height', 'Height (m)')}</Grid>
            <Grid size={GRID_HALF}>{numField('weight', 'Weight (kg)')}</Grid>
          </Grid>
          {switchField('lowFloor', 'Low floor')}
        </Stack>
      )}

      {tab === 'propulsion' && (
        <Stack spacing={2}>
          {enumMulti('propulsionTypes', 'Propulsion types', PROPULSION)}
          {enumMulti('fuelTypes', 'Fuel types', FUEL)}
          {switchField('selfPropelled', 'Self-propelled')}
          <Grid container spacing={2}>
            <Grid size={GRID_HALF}>{textField('euroClass', 'Euro class')}</Grid>
            <Grid size={GRID_HALF}>{numField('maximumVelocity', 'Max velocity (km/h)')}</Grid>
            <Grid size={GRID_HALF}>{numField('maximumRange', 'Max range (km)')}</Grid>
          </Grid>
        </Stack>
      )}

      {tab === 'capacity' && (
        <Grid container spacing={2}>
          <Grid size={GRID_HALF}>{capField('totalCapacity', 'Total')}</Grid>
          <Grid size={GRID_HALF}>{capField('seatingCapacity', 'Seating')}</Grid>
          <Grid size={GRID_HALF}>{capField('standingCapacity', 'Standing')}</Grid>
          <Grid size={GRID_HALF}>{capField('pushchairCapacity', 'Pushchair')}</Grid>
          <Grid size={GRID_HALF}>{capField('wheelchairPlaceCapacity', 'Wheelchair places')}</Grid>
          <Grid size={GRID_HALF}>{capField('pramPlaceCapacity', 'Pram places')}</Grid>
          <Grid size={GRID_HALF}>{capField('bicycleRackCapacity', 'Bicycle racks')}</Grid>
        </Grid>
      )}

      {tab === 'environment' && (
        <Stack spacing={2}>
          <Grid container spacing={2}>
            <Grid size={GRID_HALF}>{numField('formDragCoefficient', 'Form drag coefficient')}</Grid>
            <Grid size={GRID_HALF}>
              {numField('rollResistanceCoefficient', 'Roll resistance coefficient')}
            </Grid>
            <Grid size={GRID_HALF}>{numField('maximumEngineEffectKW', 'Max engine effect (kW)')}</Grid>
          </Grid>
          {enumSelect('hybridCategory', 'Hybrid category', HYBRID)}
        </Stack>
      )}
    </Box>
  );
}
