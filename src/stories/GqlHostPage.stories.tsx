import { useCallback, useState, type FC } from "react";
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
import { VehicleForm, VehicleTypeForm, type Layout } from "../index";
import { vehicleSeed, vehicleTypeSeed } from "./initDataSets";
import { vehicleLayout, vehicleTypeLayout } from "./initLayouts";
import { MOCK_ENDPOINT, installStoriesMock } from "./mockEndpoint";

/*
 * Data-aware counterpart to the Dumb-Forms stories: mounts the real,
 * package-exported VehicleForm / VehicleTypeForm (they load + save over GraphQL)
 * against an in-browser mock endpoint. Two stacked record lists — Vehicle types
 * and Vehicles — share one detail pane: clicking an item in either list
 * activates that entity's form flavour. Reproduces the host-guide "complete host
 * page" (list → select → view/edit → save) with one addition over that snippet:
 * a live status surface (Snackbar on onSaved/onError) so the async save
 * lifecycle the guide only describes in prose is actually visible.
 */

// Serve both seeds before any story renders (module scope beats effect ordering).
installStoriesMock();

const ENDPOINT = MOCK_ENDPOINT;
const LIST_WIDTH = 260;
const NEW_KEY = "new";

/** Which entity flavour the detail pane is showing. */
type Flavour = "vehicleType" | "vehicle";

/** A selected record; `netexId` omitted ⇒ a blank "new" form of that flavour. */
type Selection = { flavour: Flavour; netexId?: string };

/** Snackbar payload: a message plus which severity to colour it. */
type Toast = { msg: string; severity: "success" | "error" };

/** The data-aware form props this page drives — VehicleForm and VehicleTypeForm
 *  share one shape (layout is the base `Layout`, not entity-specific). */
type DataAwareForm = FC<{
  endpoint: string;
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
  netexId?: string;
  mode?: "view" | "edit";
  layout?: Layout;
  onSaved?: (netexId: string) => void;
  onError?: (generalErrors: string[]) => void;
}>;

/** Minimal record shape the lists need from either entity. */
type Rec = { netexId: string; name?: { value?: string | null } | null };

/** Per-flavour wiring: its form component, layout, seed, and list labels. */
const FLAVOURS: Record<
  Flavour,
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

const FLAVOUR_ORDER: Flavour[] = ["vehicleType", "vehicle"];

/**
 * Single host screen with two stacked record lists (Vehicle types + Vehicles)
 * feeding one detail pane. Selecting an item swaps the pane to that entity's
 * data-aware form; the pane owns the four host concerns — stable auth headers,
 * new-vs-edit via `netexId`, discard via remount `key`, and reacting to saves.
 */
const GqlHostPage = () => {
  const [selection, setSelection] = useState<Selection | null>({
    flavour: "vehicle",
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

  const selectRecord = (flavour: Flavour, netexId?: string) => {
    setSelection({ flavour, netexId });
    setMode(netexId ? "view" : "edit"); // existing → view; new → straight to edit
  };
  const cancel = () => {
    setRev((r) => r + 1); // discard edits by reloading
    setMode("view");
  };

  const active = selection ? FLAVOURS[selection.flavour] : null;
  const Form = active?.Form;

  return (
    <Paper
      elevation={0}
      sx={{ display: "flex", minHeight: "100vh", bgcolor: "grey.100" }}
    >
      {/* Left: two stacked record lists, one per flavour. */}
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
        {FLAVOUR_ORDER.map((flavour) => {
          const cfg = FLAVOURS[flavour];
          return (
            <Box key={flavour}>
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
                      onClick={() => selectRecord(flavour)}
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
                      selection?.flavour === flavour &&
                      selection?.netexId === r.netexId
                    }
                    onClick={() => selectRecord(flavour, r.netexId)}
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

      {/* Right: the selected flavour's data-aware form + host chrome. */}
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
                // New key ⇒ remount: clean flavour/record switch + discard on cancel.
                key={`${selection.flavour}:${selection.netexId ?? NEW_KEY}:${rev}`}
                endpoint={ENDPOINT}
                getHeaders={getHeaders}
                netexId={selection.netexId}
                mode={mode}
                layout={active.layout}
                onSaved={(id) => {
                  setSelection({ flavour: selection.flavour, netexId: id });
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
};
export default meta;
type Story = StoryObj<typeof GqlHostPage>;

export const HostPage01: Story = {};
