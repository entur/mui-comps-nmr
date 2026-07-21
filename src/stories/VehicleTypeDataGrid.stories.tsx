/**
 * Kitchen-sink showcase of the **MIT (Community) edition** of MUI X DataGrid
 * (`@mui/x-data-grid` v8), driven by 250 randomly-generated `VehicleType` rows.
 *
 * Every feature wired up here ships in the free tier:
 *   - sorting (single-column — multi-sort is Pro), single-column filtering,
 *     quick-filter search, pagination, column resize / visibility / menu,
 *     density switching, checkbox row selection, CSV + Print export,
 *     cell editing (`processRowUpdate`), custom cell rendering, row striping,
 *     and the v8 composable toolbar primitives.
 *
 * Deliberately excluded — these require Pro/Premium and are *forced off* by the
 * community grid (`DataGridForcedPropsKey`): column reordering, multi-column
 * sort/filter, column/row pinning, row grouping, tree data, master-detail,
 * aggregation, and Excel export.
 */
import { useMemo, useState, type MouseEvent } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Box,
  Chip,
  LinearProgress,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ViewColumnIcon from "@mui/icons-material/ViewColumn";
import FilterListIcon from "@mui/icons-material/FilterList";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import PrintIcon from "@mui/icons-material/Print";
import DensityMediumIcon from "@mui/icons-material/DensityMedium";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import {
  DataGrid,
  Toolbar,
  ToolbarButton,
  ColumnsPanelTrigger,
  FilterPanelTrigger,
  ExportCsv,
  ExportPrint,
  QuickFilter,
  QuickFilterControl,
  useGridApiContext,
  type GridColDef,
  type GridRowsProp,
  type GridDensity,
  type GridRenderCellParams,
} from "@mui/x-data-grid";
import type { VehicleType } from "../index";
import {
  FareClass,
  PropulsionType,
  TransportMode,
} from "../generated/sobekTypes";

/* ------------------------------------------------------------------ *\
   Constants
\* ------------------------------------------------------------------ */

const ROW_COUNT = 250; // rows the generator emits
const SEED = 0x9e3779b9; // fixed PRNG seed → reproducible grid across reloads
const PAGE_SIZES = [10, 25, 50, 100];
const DENSITIES: GridDensity[] = ["compact", "standard", "comfortable"];

/** Sample pools for the random generator. */
const MAKERS = [
  "Stadler",
  "Alstom",
  "Siemens",
  "CAF",
  "Škoda",
  "Hitachi",
  "Bombardier",
  "Solaris",
];
const MODELS = [
  "FLIRT",
  "Coradia",
  "Mireo",
  "Civity",
  "Panter",
  "AT-200",
  "Talent",
  "Urbino",
];
const TRANSPORT = [
  TransportMode.Rail,
  TransportMode.Bus,
  TransportMode.Tram,
  TransportMode.Metro,
  TransportMode.Ferry,
];
const PROPULSION = Object.values(PropulsionType);
const FARE = Object.values(FareClass);

/** transportMode → chip palette. */
const MODE_COLOR: Partial<
  Record<
    TransportMode,
    "primary" | "secondary" | "success" | "warning" | "info"
  >
> = {
  [TransportMode.Rail]: "primary",
  [TransportMode.Bus]: "success",
  [TransportMode.Tram]: "secondary",
  [TransportMode.Metro]: "warning",
  [TransportMode.Ferry]: "info",
};

/** Striped-row background applied via `getRowClassName`. */
const GRID_SX = {
  "& .row-odd": { backgroundColor: "action.hover" },
  border: 1,
  borderColor: "divider",
} as const;

/* ------------------------------------------------------------------ *\
   Random row generator
\* ------------------------------------------------------------------ */

/** mulberry32 — tiny deterministic PRNG so the demo is stable per seed. */
const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Build `n` randomized `VehicleType` rows from a seeded PRNG.
 *
 * @param n    How many rows to emit.
 * @param seed PRNG seed; same seed → identical rows (reproducible showcase).
 * @returns An array of fully-populated `VehicleType` objects.
 */
const genVehicleTypes = (n: number, seed: number): VehicleType[] => {
  const rnd = mulberry32(seed);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
  const num = (lo: number, hi: number, dp = 1): number =>
    Math.round((lo + rnd() * (hi - lo)) * 10 ** dp) / 10 ** dp;
  const day = (offset: number): string =>
    new Date(
      Date.UTC(2018, 0, 1) + Math.floor(rnd() * offset) * 86_400_000,
    ).toISOString();

  return Array.from({ length: n }, (_, i): VehicleType => {
    const seating = Math.floor(num(40, 320, 0));
    const standing = Math.floor(num(0, 180, 0));
    const total = seating + standing;
    return {
      netexId: `VEH:VehicleType:${1000 + i}`,
      name: {
        lang: "en",
        value: `${pick(MAKERS)} ${pick(MODELS)} ${10 + (i % 90)}`,
      },
      transportMode: pick(TRANSPORT),
      manufacturer: pick(MAKERS),
      propulsionTypes: Array.from(
        new Set([pick(PROPULSION), pick(PROPULSION)]),
      ),
      length: num(12, 220),
      width: num(2.4, 3.2, 2),
      height: num(3, 4.5, 2),
      weight: num(12, 95),
      range: num(180, 1200, 0),
      fullCharge: num(40, 600, 0),
      lowFloor: rnd() > 0.4,
      carLoading: rnd() > 0.8,
      selfPropelled: rnd() > 0.3,
      passengerCapacity: {
        totalCapacity: total,
        seatingCapacity: seating,
        standingCapacity: standing,
        fareClass: pick(FARE),
      },
      created: day(1500),
      changed: day(2800),
    };
  });
};

/* ------------------------------------------------------------------ *\
   Cell renderers
\* ------------------------------------------------------------------ */

const ModeCell = ({
  value,
}: GridRenderCellParams<VehicleType, TransportMode>) =>
  value ? (
    <Chip size="small" label={value} color={MODE_COLOR[value] ?? "default"} />
  ) : null;

const PropulsionCell = ({
  value,
}: GridRenderCellParams<VehicleType, PropulsionType[]>) => (
  <Stack
    direction="row"
    spacing={0.5}
    sx={{ flexWrap: "wrap", gap: 0.5, py: 0.5 }}
  >
    {(value ?? []).map((p) => (
      <Chip key={p} size="small" variant="outlined" label={p} />
    ))}
  </Stack>
);

const BoolCell = ({ value }: GridRenderCellParams<VehicleType, boolean>) =>
  value ? (
    <CheckCircleIcon fontSize="small" color="success" />
  ) : (
    <CancelIcon fontSize="small" sx={{ color: "text.disabled" }} />
  );

/** Seating-share bar (seating ÷ total capacity), 0–100. */
const SeatRatioCell = ({
  value,
}: GridRenderCellParams<VehicleType, number>) => (
  <Stack direction="row" alignItems="center" spacing={1} sx={{ width: "100%" }}>
    <LinearProgress
      variant="determinate"
      value={value ?? 0}
      sx={{ flex: 1, height: 6, borderRadius: 1 }}
    />
    <Typography variant="caption" color="text.secondary">
      {value ?? 0}%
    </Typography>
  </Stack>
);

/* ------------------------------------------------------------------ *\
   Columns
\* ------------------------------------------------------------------ */

const unit = (suffix: string) => (value: number | null | undefined) =>
  value == null ? "" : `${value} ${suffix}`;

const columns: GridColDef<VehicleType>[] = [
  { field: "netexId", headerName: "NeTEx ID", width: 150 },
  {
    field: "name",
    headerName: "Name",
    width: 200,
    editable: true,
    // valueGetter + valueSetter pair: flatten the MultilingualString to its
    // `.value` leaf for display/edit, then re-nest the edited string on commit.
    valueGetter: (_v, row) => row.name?.value ?? "",
    valueSetter: (value, row) => ({
      ...row,
      name: { ...row.name, lang: row.name?.lang ?? "en", value },
    }),
  },
  {
    field: "transportMode",
    headerName: "Mode",
    width: 120,
    editable: true,
    type: "singleSelect",
    valueOptions: TRANSPORT,
    renderCell: ModeCell,
  },
  {
    field: "manufacturer",
    headerName: "Manufacturer",
    width: 140,
    editable: true,
  },
  {
    field: "propulsionTypes",
    headerName: "Propulsion",
    width: 200,
    sortable: false,
    filterable: false,
    renderCell: PropulsionCell,
  },
  {
    field: "length",
    headerName: "Length",
    width: 110,
    type: "number",
    editable: true,
    valueFormatter: unit("m"),
  },
  {
    field: "width",
    headerName: "Width",
    width: 100,
    type: "number",
    editable: true,
    valueFormatter: unit("m"),
  },
  {
    field: "height",
    headerName: "Height",
    width: 100,
    type: "number",
    editable: true,
    valueFormatter: unit("m"),
  },
  {
    field: "weight",
    headerName: "Weight",
    width: 110,
    type: "number",
    editable: true,
    valueFormatter: unit("t"),
  },
  {
    field: "range",
    headerName: "Range",
    width: 110,
    type: "number",
    editable: true,
    valueFormatter: unit("km"),
  },
  {
    field: "fullCharge",
    headerName: "Full Charge",
    width: 120,
    type: "number",
    editable: true,
    valueFormatter: unit("kWh"),
  },
  {
    field: "seatRatio",
    headerName: "Seating share",
    width: 160,
    sortable: false,
    filterable: false,
    // Computed column — value derived from the nested passengerCapacity leaves.
    valueGetter: (_v, row) => {
      const t = row.passengerCapacity?.totalCapacity ?? 0;
      const s = row.passengerCapacity?.seatingCapacity ?? 0;
      return t ? Math.round((s / t) * 100) : 0;
    },
    renderCell: SeatRatioCell,
  },
  {
    field: "lowFloor",
    headerName: "Low floor",
    width: 100,
    type: "boolean",
    editable: true,
    renderCell: BoolCell,
  },
  {
    field: "carLoading",
    headerName: "Car loading",
    width: 110,
    type: "boolean",
    editable: true,
    renderCell: BoolCell,
  },
  {
    field: "selfPropelled",
    headerName: "Self-propelled",
    width: 130,
    type: "boolean",
    editable: true,
    renderCell: BoolCell,
  },
  {
    field: "fareClass",
    headerName: "Fare class",
    width: 150,
    editable: true,
    type: "singleSelect",
    valueOptions: FARE,
    valueGetter: (_v, row) => row.passengerCapacity?.fareClass ?? "",
    renderCell: ({ value }) =>
      value ? (
        <Chip size="small" variant="outlined" label={String(value)} />
      ) : null,
  },
  {
    field: "created",
    headerName: "Created",
    width: 120,
    type: "date",
    valueGetter: (_v, row) => (row.created ? new Date(row.created) : null),
  },
  {
    field: "changed",
    headerName: "Changed",
    width: 120,
    type: "date",
    valueGetter: (_v, row) => (row.changed ? new Date(row.changed) : null),
  },
];

/* ------------------------------------------------------------------ *\
   Custom toolbar (v8 composable primitives)
\* ------------------------------------------------------------------ */

/** Density picker — there is no composable density trigger primitive, so this
 *  drives the grid imperatively through the API ref. */
const DensityControl = () => {
  const apiRef = useGridApiContext();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <Tooltip title="Density">
        <ToolbarButton
          onClick={(e: MouseEvent<HTMLButtonElement>) =>
            setAnchor(e.currentTarget)
          }
        >
          <DensityMediumIcon fontSize="small" />
        </ToolbarButton>
      </Tooltip>
      <Menu open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)}>
        {DENSITIES.map((d) => (
          <MenuItem
            key={d}
            onClick={() => {
              apiRef.current?.setDensity(d);
              setAnchor(null);
            }}
            sx={{ textTransform: "capitalize" }}
          >
            {d}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

/**
 * Build the showcase toolbar: column-panel / filter-panel triggers, the density
 * control, CSV + Print export, a quick-filter search box, and two row-mutating
 * actions (add / regenerate) supplied by the story.
 *
 * @param onAdd        Prepend a fresh random row.
 * @param onRegenerate Reseed the whole dataset.
 */
const makeToolbar = (onAdd: () => void, onRegenerate: () => void) => () => (
  <Toolbar>
    <Tooltip title="Columns">
      <ColumnsPanelTrigger render={<ToolbarButton />}>
        <ViewColumnIcon fontSize="small" />
      </ColumnsPanelTrigger>
    </Tooltip>
    <Tooltip title="Filter">
      <FilterPanelTrigger render={<ToolbarButton />}>
        <FilterListIcon fontSize="small" />
      </FilterPanelTrigger>
    </Tooltip>
    <DensityControl />
    <Tooltip title="Export CSV">
      <ExportCsv render={<ToolbarButton />}>
        <FileDownloadIcon fontSize="small" />
      </ExportCsv>
    </Tooltip>
    <Tooltip title="Print">
      <ExportPrint render={<ToolbarButton />}>
        <PrintIcon fontSize="small" />
      </ExportPrint>
    </Tooltip>
    <Tooltip title="Add row">
      <ToolbarButton onClick={onAdd}>
        <AddIcon fontSize="small" />
      </ToolbarButton>
    </Tooltip>
    <Tooltip title="Regenerate">
      <ToolbarButton onClick={onRegenerate}>
        <RefreshIcon fontSize="small" />
      </ToolbarButton>
    </Tooltip>
    <Box sx={{ flex: 1 }} />
    <QuickFilter defaultExpanded>
      <QuickFilterControl
        render={({ ref, ...props }) => (
          <TextField
            {...props}
            inputRef={ref}
            size="small"
            placeholder="Search…"
            sx={{ width: 200 }}
          />
        )}
      />
    </QuickFilter>
  </Toolbar>
);

/* ------------------------------------------------------------------ *\
   Story component
\* ------------------------------------------------------------------ */

/** The full showcase: stateful rows + every MIT DataGrid feature switched on. */
const Showcase = () => {
  const [seed, setSeed] = useState(SEED);
  const [rows, setRows] = useState<GridRowsProp<VehicleType>>(() =>
    genVehicleTypes(ROW_COUNT, SEED),
  );

  const slots = useMemo(
    () => ({
      toolbar: makeToolbar(
        () =>
          setRows((rs) => [genVehicleTypes(1, seed + rs.length + 1)[0], ...rs]),
        () => {
          const next = seed + 1;
          setSeed(next);
          setRows(genVehicleTypes(ROW_COUNT, next));
        },
      ),
    }),
    [seed],
  );

  return (
    <Box
      sx={{
        height: "100vh",
        width: "100%",
        p: 2,
        boxSizing: "border-box",
        bgcolor: "grey.50",
      }}
    >
      <Typography variant="h6" gutterBottom>
        MUI X DataGrid — MIT edition ({ROW_COUNT} VehicleType rows)
      </Typography>
      <Box sx={{ height: "calc(100% - 48px)", width: "100%" }}>
        <DataGrid<VehicleType>
          rows={rows}
          columns={columns}
          getRowId={(r) => r.netexId}
          // Editing — commit edits straight into local state.
          editMode="cell"
          processRowUpdate={(updated) => {
            setRows((rs) =>
              rs.map((r) => (r.netexId === updated.netexId ? updated : r)),
            );
            return updated;
          }}
          onProcessRowUpdateError={(e) => console.error(e)}
          // Selection.
          checkboxSelection
          disableRowSelectionOnClick
          // Pagination.
          pagination
          pageSizeOptions={PAGE_SIZES}
          // Toolbar (custom, built from v8 primitives).
          showToolbar
          slots={slots}
          // Striping.
          getRowClassName={(p) =>
            p.indexRelativeToCurrentPage % 2 ? "row-odd" : ""
          }
          initialState={{
            pagination: { paginationModel: { pageSize: 25, page: 0 } },
            sorting: { sortModel: [{ field: "name", sort: "asc" }] },
          }}
          sx={GRID_SX}
        />
      </Box>
    </Box>
  );
};

const meta: Meta<typeof Showcase> = {
  title: "DataGrid/VT",
  component: Showcase,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof Showcase>;

export const KitchenSink: Story = {};
