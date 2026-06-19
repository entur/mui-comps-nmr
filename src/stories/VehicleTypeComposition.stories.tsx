import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Box, Button, Card, CardContent, Drawer, Paper, Typography } from "@mui/material";
import type { VehicleType } from "../index";
import { VehicleTypeForm, vehicleTypeLayout, vehicleTypeSample } from "./initDataSets";

// Width of the form Drawer (right anchor).
const DRAWER_WIDTH = 480;

/**
 * Composition: a Paper surface holding a centered Card whose button opens the
 * `VehicleTypeForm` in a right-anchored Drawer. The form value is owned here so
 * edits made in the Drawer round-trip and survive close/reopen.
 */
const VehicleTypeDrawerComposition = () => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<VehicleType>(vehicleTypeSample);

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
          <Typography variant="body1" align="center">
            Click button to open Form in Drawer
          </Typography>
          <Button variant="contained" onClick={() => setOpen(true)}>
            Open Form
          </Button>
        </CardContent>
      </Card>

      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: DRAWER_WIDTH, p: 3 }}>
          <VehicleTypeForm
            mode="edit"
            layout={vehicleTypeLayout}
            value={value}
            onChange={setValue}
          />
        </Box>
      </Drawer>
    </Paper>
  );
};

const meta: Meta<typeof VehicleTypeDrawerComposition> = {
  title: "compositions/VehicleType",
  component: VehicleTypeDrawerComposition,
  parameters: { layout: "fullscreen" },
};
export default meta;
type Story = StoryObj<typeof VehicleTypeDrawerComposition>;

export const Default: Story = {};
