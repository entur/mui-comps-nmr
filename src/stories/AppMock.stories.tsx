import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Box,
  Button,
  Card,
  CardContent,
  Drawer,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import type { Vehicle, VehicleType } from "../index";
import {
  VehicleForm,
  VehicleTypeForm,
  vehicleLayout,
  vehicleTypeLayout,
  vehicleSample,
  vehicleTypeSample,
} from "./initDataSets";

// Width of the form Drawer (right anchor).
const DRAWER_WIDTH = 480;

/** Which entity flavour the Drawer is showing (null = closed). */
type Flavour = "type" | "vehicle" | null;

/**
 * App mock: a Paper surface holding a centered Card whose two buttons each open
 * a right-anchored Drawer onto the matching form — "Type" → VehicleTypeForm,
 * "Vehicle" → VehicleForm. Each form's value is owned here so edits round-trip
 * and survive close/reopen.
 */
const AppMock = () => {
  const [open, setOpen] = useState<Flavour>(null);
  const [vehicleType, setVehicleType] = useState<VehicleType>(vehicleTypeSample);
  const [vehicle, setVehicle] = useState<Vehicle>(vehicleSample);
  // User choices steering the Drawer forms. Off by default → stacked + editable.
  const [tabs, setTabs] = useState(false);
  const [readOnly, setReadOnly] = useState(false);

  const variant = tabs ? "tabs" : "stacked";
  const mode = readOnly ? "view" : "edit";

  return (
    <Paper
      elevation={0}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 360,
        p: 4,
        bgcolor: "grey.100",
      }}
    >
      <Card sx={{ maxWidth: 360, width: "100%" }}>
        <CardContent
          sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}
        >
          <Stack alignItems="flex-start">
            <FormControlLabel
              control={<Switch checked={tabs} onChange={e => setTabs(e.target.checked)} />}
              label="tabs"
            />
            <FormControlLabel
              control={<Switch checked={readOnly} onChange={e => setReadOnly(e.target.checked)} />}
              label="read-only"
            />
          </Stack>
          <Typography variant="body1" align="center">
            Click a button to open its Form in a Drawer
          </Typography>
          <Stack direction="row" spacing={2}>
            <Button variant="contained" onClick={() => setOpen("type")}>
              Type
            </Button>
            <Button variant="contained" onClick={() => setOpen("vehicle")}>
              Vehicle
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Drawer anchor="right" open={open !== null} onClose={() => setOpen(null)}>
        <Box sx={{ width: DRAWER_WIDTH, p: 3 }}>
          {open === "type" && (
            <VehicleTypeForm
              mode={mode}
              variant={variant}
              layout={vehicleTypeLayout}
              value={vehicleType}
              onChange={setVehicleType}
            />
          )}
          {open === "vehicle" && (
            <VehicleForm
              mode={mode}
              variant={variant}
              layout={vehicleLayout}
              value={vehicle}
              onChange={setVehicle}
            />
          )}
        </Box>
      </Drawer>
    </Paper>
  );
};

const meta: Meta<typeof AppMock> = {
  title: "compositions/AppMock",
  component: AppMock,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof AppMock>;

export const Default: Story = {};
