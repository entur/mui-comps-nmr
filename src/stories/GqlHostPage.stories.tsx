import { useCallback, useMemo, useState, type FC } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  ListSubheader,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import {
  VehicleForm,
  VehicleTypeForm,
  type Layout,
  type LayoutVariant,
  type ControlSlotProps,
} from "../index";
import { vehicleSeed, vehicleTypeSeed } from "./initDataSets";
import { vehicleLayout, vehicleTypeLayout } from "./initLayouts";
import { MOCK_ENDPOINT, installStoriesMock } from "./mockEndpoint";

/*
 * Data-aware counterpart to the Dumb-Forms stories: mounts the real,
 * package-exported VehicleForm / VehicleTypeForm (they load + save over GraphQL)
 * against an in-browser mock endpoint. Two stacked record lists — Vehicle types
 * and Vehicles — share one detail pane: clicking an item in either list
 * activates that entity's form. Reproduces the host-guide "complete host
 * page" (list → select → view/edit → save) with one addition over that snippet:
 * a live status surface (Snackbar on onSaved/onError) so the async save
 * lifecycle the guide only describes in prose is actually visible.
 */

// Serve both seeds before any story renders (module scope beats effect ordering).
installStoriesMock();

const ENDPOINT = MOCK_ENDPOINT;
const LIST_WIDTH = 260;
const NEW_KEY = "new";

/**
 * How a multi-section form presents its sections (mirrors DumbAppMock):
 * - `none`     → no tab bar (stacked sections).
 * - `one-line` → scrollable tabs on one row, `>` chevrons for overflow.
 * - `pills`    → wrapping filled-pill tabs (hathor's VehicleTypeForm style).
 */
type TabStyle = "none" | "one-line" | "pills";

/** `slotProps` reproducing hathor's wrapping pill tabs: `standard` variant (so
 *  the row can wrap) + a flex-wrap container + filled-pill tab styling. */
const PILL_TABS_SX = {
  minHeight: 0,
  "& .MuiTabs-indicator": { display: "none" },
  "& .MuiTabs-flexContainer": { flexWrap: "wrap", gap: 0.75 },
  "& .MuiTab-root": {
    minHeight: 30,
    px: 1.25,
    py: 0.25,
    borderRadius: 1,
    textTransform: "none",
    bgcolor: "action.hover",
    color: "text.secondary",
  },
  "& .MuiTab-root.Mui-selected": {
    bgcolor: "primary.main",
    color: "primary.contrastText",
  },
} as const;

/** Derive a form's `variant` + Tabs `slotProps` from a {@link TabStyle}. */
const deriveTabs = (
  tabStyle: TabStyle,
): { variant: LayoutVariant; slotProps: ControlSlotProps } => {
  if (tabStyle === "none") return { variant: "stacked", slotProps: {} };
  if (tabStyle === "pills")
    return { variant: "tabs", slotProps: { tabs: { variant: "standard", sx: PILL_TABS_SX } } };
  return {
    variant: "tabs",
    slotProps: {
      tabs: { variant: "scrollable", scrollButtons: "auto", allowScrollButtonsMobile: true },
    },
  };
};

/** Which entity the detail pane is showing. */
type entity = "vehicleType" | "vehicle";

/** A selected record; `netexId` omitted ⇒ a blank "new" form of that entity. */
type Selection = { entity: entity; netexId?: string };

/** Snackbar payload: a message plus which severity to colour it. */
type Toast = { msg: string; severity: "success" | "error" };

/** The data-aware form props this page drives — VehicleForm and VehicleTypeForm
 *  share one shape (layout is the base `Layout`, not entity-specific). */
type DataAwareForm = FC<{
  endpoint: string;
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
  netexId?: string;
  mode?: "view" | "edit";
  variant?: LayoutVariant;
  slotProps?: ControlSlotProps;
  layout?: Layout;
  onSaved?: (netexId: string) => void;
  onError?: (generalErrors: string[]) => void;
}>;

/** Minimal record shape the lists need from either entity. */
type Rec = { netexId: string; name?: { value?: string | null } | null };

/** Per-entity wiring: its form component, layout, seed, and list labels. */
const ENTITY: Record<
  entity,
  {
    Form: DataAwareForm;
    layout: Layout;
    seed: Record<string, Rec>;
    heading: string;
    newLabel: string;
  }
> = {
  vehicleType: {
    Form: VehicleTypeForm,
    layout: vehicleTypeLayout,
    seed: vehicleTypeSeed,
    heading: "Vehicle types",
    newLabel: "New vehicle type",
  },
  vehicle: {
    Form: VehicleForm,
    layout: vehicleLayout,
    seed: vehicleSeed,
    heading: "Vehicles",
    newLabel: "New vehicle",
  },
};

const ENTITY_ORDER: entity[] = ["vehicleType", "vehicle"];

/** Story-adjustable props, surfaced as Storybook Controls. */
interface GqlHostPageProps {
  /** How multi-section forms (VehicleType) present sections. Single-section
   *  Vehicle renders flat regardless. */
  tabStyle?: TabStyle;
}

/**
 * Single host screen with two stacked record lists (Vehicle types + Vehicles)
 * feeding one detail pane. Selecting an item swaps the pane to that entity's
 * data-aware form; the pane owns the four host concerns — stable auth headers,
 * new-vs-edit via `netexId`, discard via remount `key`, and reacting to saves.
 */
const GqlHostPage = ({ tabStyle = "one-line" }: GqlHostPageProps) => {
  const { variant, slotProps } = useMemo(() => deriveTabs(tabStyle), [tabStyle]);
  const [selection, setSelection] = useState<Selection | null>({
    entity: "vehicle",
    netexId: "VEH:Vehicle:701",
  });
  const [mode, setMode] = useState<"view" | "edit">("view");
  // Bumping this remounts the form (via `key`) → reload a clean copy = "cancel".
  const [rev, setRev] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);

  // Stable across renders (host-guide §2/§3): a fresh function each render would
  // read as "auth changed" and reload, dropping in-progress edits.
  const getHeaders = useCallback(
    async () => ({ Authorization: "Bearer demo-token" }),
    [],
  );

  const selectRecord = (entity: entity, netexId?: string) => {
    setSelection({ entity, netexId });
    setMode(netexId ? "view" : "edit"); // existing → view; new → straight to edit
  };
  const cancel = () => {
    setRev((r) => r + 1); // discard edits by reloading
    setMode("view");
  };

  const active = selection ? ENTITY[selection.entity] : null;
  const Form = active?.Form;

  return (
    <Paper
      elevation={0}
      sx={{ display: "flex", minHeight: "100vh", bgcolor: "grey.100" }}
    >
      {/* Left: two stacked record lists, one per entity. */}
      <Box
        sx={{
          width: LIST_WIDTH,
          flexShrink: 0,
          borderRight: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
          overflowY: "auto",
        }}
      >
        {ENTITY_ORDER.map((entity) => {
          const cfg = ENTITY[entity];
          return (
            <Box key={entity}>
              <List
                dense
                subheader={
                  // 2-col header: title (left) + new-button (right).
                  <ListSubheader
                    disableSticky
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      pr: 1,
                    }}
                  >
                    {cfg.heading}
                    <IconButton
                      size="small"
                      edge="end"
                      aria-label={cfg.newLabel}
                      title={cfg.newLabel}
                      onClick={() => selectRecord(entity)}
                    >
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </ListSubheader>
                }
              >
                {Object.values(cfg.seed).map((r) => (
                  <ListItemButton
                    key={r.netexId}
                    selected={
                      selection?.entity === entity &&
                      selection?.netexId === r.netexId
                    }
                    onClick={() => selectRecord(entity, r.netexId)}
                  >
                    <ListItemText
                      primary={r.name?.value ?? r.netexId}
                      secondary={r.netexId}
                    />
                  </ListItemButton>
                ))}
              </List>
              <Divider />
            </Box>
          );
        })}
      </Box>

      {/* Right: the selected entity's data-aware form + host chrome. */}
      <Box sx={{ flex: 1, minWidth: 0, p: { xs: 2, sm: 4 } }}>
        {selection && active && Form ? (
          <>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 2 }}
            >
              <Typography variant="h6">
                {selection.netexId ?? active.newLabel}
              </Typography>
              {mode === "view" ? (
                <Button variant="outlined" onClick={() => setMode("edit")}>
                  Edit
                </Button>
              ) : (
                <Button color="inherit" onClick={cancel}>
                  Cancel
                </Button>
              )}
            </Stack>

            <Paper
              variant="outlined"
              sx={{ p: { xs: 2, sm: 3 }, maxWidth: 680 }}
            >
              <Form
                // New key ⇒ remount: clean entity/record switch + discard on cancel.
                key={`${selection.entity}:${selection.netexId ?? NEW_KEY}:${rev}`}
                endpoint={ENDPOINT}
                getHeaders={getHeaders}
                netexId={selection.netexId}
                mode={mode}
                variant={variant}
                slotProps={slotProps}
                layout={active.layout}
                onSaved={(id) => {
                  setSelection({ entity: selection.entity, netexId: id });
                  setMode("view");
                  setToast({ msg: `Saved ${id}`, severity: "success" });
                }}
                onError={(msgs) =>
                  setToast({
                    msg: msgs.join("\n") || "Save failed",
                    severity: "error",
                  })
                }
              />
            </Paper>
          </>
        ) : (
          <Typography color="text.secondary">
            Select a record to view or edit.
          </Typography>
        )}
      </Box>

      <Snackbar
        open={toast !== null}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {toast ? (
          <Alert
            severity={toast.severity}
            variant="filled"
            onClose={() => setToast(null)}
          >
            {toast.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Paper>
  );
};

const meta: Meta<typeof GqlHostPage> = {
  title: "compositions/GqlHostPages",
  component: GqlHostPage,
  parameters: { layout: "fullscreen" },
  args: { tabStyle: "one-line" },
  argTypes: {
    tabStyle: {
      control: "inline-radio",
      options: ["none", "one-line", "pills"],
      description:
        "How multi-section forms (VehicleType) present sections: none = stacked (no tabs), one-line = scrollable tab row, pills = wrapping pill tabs. Vehicle is single-section, so unaffected.",
    },
  },
};
export default meta;
type Story = StoryObj<typeof GqlHostPage>;

export const HostPage01: Story = {};
