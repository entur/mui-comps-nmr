import { useCallback, useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Alert,
  Box,
  Button,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { VehicleForm } from "../index";
import { vehicleSeed } from "./initDataSets";
import { vehicleLayout } from "./initLayouts";
import { MOCK_ENDPOINT, installMockVehicleFetch } from "./mockEndpoint";

/*
 * Data-aware counterpart to the Dumb-Forms stories: this mounts the real,
 * package-exported `VehicleForm` (loads + saves over GraphQL) against an
 * in-browser mock endpoint, reproducing the host-guide's "complete host page"
 * — list → select → view/edit → save — with one addition over that snippet: a
 * live status surface (snackbar on `onSaved` / `onError`) so the async save
 * lifecycle the guide only describes in prose is actually visible.
 */

// Serve the seed before any story renders, so the form's on-mount load is
// already intercepted (module scope beats effect ordering).
installMockVehicleFetch(vehicleSeed);

const ENDPOINT = MOCK_ENDPOINT;
const LIST_WIDTH = 240;
const NEW_KEY = "new";

/** Snackbar payload: a message plus which severity to colour it. */
type Toast = { msg: string; severity: "success" | "error" };

/**
 * A minimal host screen around the data-aware `VehicleForm`: a record list on
 * the left, the form on the right. Demonstrates the four things a host owns —
 * stable auth headers, new-vs-edit via `netexId`, discard via remount `key`,
 * and reacting to save outcomes — none of which the form does for you.
 */
const VehicleHostPage = () => {
  const [selected, setSelected] = useState<string | undefined>(
    "VEH:Vehicle:701",
  );
  const [mode, setMode] = useState<"view" | "edit">("view");
  // Bumping this remounts the form (via `key`) → reload a clean copy = "cancel".
  const [rev, setRev] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);

  // Stable across renders (§2/§3 of the host guide): a fresh function each
  // render would read as "auth changed" and reload, dropping in-progress edits.
  const getHeaders = useCallback(
    async () => ({ Authorization: "Bearer demo-token" }),
    [],
  );

  const records = useMemo(() => Object.values(vehicleSeed), []);

  const openNew = () => {
    setSelected(undefined);
    setMode("edit");
  };
  const open = (netexId: string) => {
    setSelected(netexId);
    setMode("view");
  };
  const cancel = () => {
    setRev((r) => r + 1); // discard edits by reloading
    setMode("view");
  };

  return (
    <Paper
      elevation={0}
      sx={{ display: "flex", minHeight: "100vh", bgcolor: "grey.100" }}
    >
      {/* Left: record list + New. */}
      <Box
        sx={{
          width: LIST_WIDTH,
          flexShrink: 0,
          borderRight: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Box sx={{ p: 2 }}>
          <Button fullWidth variant="contained" onClick={openNew}>
            + New vehicle
          </Button>
        </Box>
        <Divider />
        <List dense disablePadding>
          {records.map((v) => (
            <ListItemButton
              key={v.netexId}
              selected={v.netexId === selected}
              onClick={() => open(v.netexId)}
            >
              <ListItemText
                primary={v.name?.value ?? v.netexId}
                secondary={v.netexId}
              />
            </ListItemButton>
          ))}
        </List>
      </Box>

      {/* Right: the data-aware form + host chrome. */}
      <Box sx={{ flex: 1, minWidth: 0, p: { xs: 2, sm: 4 } }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 2 }}
        >
          <Typography variant="h6">
            {selected ? selected : "New vehicle"}
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

        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, maxWidth: 640 }}>
          <VehicleForm
            // New key ⇒ remount: clean switch between records + discard on cancel.
            key={`${selected ?? NEW_KEY}:${rev}`}
            endpoint={ENDPOINT}
            getHeaders={getHeaders}
            netexId={selected}
            mode={mode}
            layout={vehicleLayout}
            onSaved={(id) => {
              setSelected(id);
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

const meta: Meta<typeof VehicleHostPage> = {
  title: "compositions/GQLHostPage",
  component: VehicleHostPage,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof VehicleHostPage>;

export const VehicleHostPage01: Story = {};
